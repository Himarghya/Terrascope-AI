import os
import cv2
import numpy as np
import math
import sys
sys.path.append(os.path.join(os.getcwd(), "backend"))

from core.geodepth_pipeline import GeoDepthPipeline
from core.preprocessor import detect_map_ui_chrome

def extract_holistic_buildings(seg, hgt, rgb_img, gsd_m=0.35, min_area_m2=15.0):
    """
    Extracts holistic single-building footprints:
    - Never slices a single house into multiple disjoint polygons.
    - Fills internal holes and closes roof ridge seams.
    - Merges adjacent roof fragments belonging to the same building.
    - Predominantly fits the building shape (Rectangle OBB or Orthogonal L/T-Shape).
    """
    h, w = rgb_img.shape[:2]
    ui_mask = detect_map_ui_chrome(rgb_img)
    m = ((seg == 2) & (ui_mask == 0)).astype(np.uint8)

    # 1. Morphological closing to seal roof seams, ridge lines, and solar panel gaps
    k_close = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k_close)

    # 2. Fill small internal holes in roofs (skylights, vents, shadows)
    cnts_holes, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    for ch in cnts_holes:
        if cv2.contourArea(ch) < 400:  # holes smaller than 400px are roof features
            cv2.drawContours(m, [ch], -1, 1, -1)

    min_area_px = max(8, int(round(min_area_m2 / max(gsd_m ** 2, 0.04))))

    # Connected components
    num_cc, cc_labels, cc_stats, _ = cv2.connectedComponentsWithStats(m)
    raw_contours = []

    for cid in range(1, num_cc):
        area = cc_stats[cid, cv2.CC_STAT_AREA]
        if area < min_area_px:
            continue
        x = cc_stats[cid, cv2.CC_STAT_LEFT]
        y = cc_stats[cid, cv2.CC_STAT_TOP]
        bw = cc_stats[cid, cv2.CC_STAT_WIDTH]
        bh = cc_stats[cid, cv2.CC_STAT_HEIGHT]

        area_m2 = area * (gsd_m ** 2)
        dim_m = max(bw, bh) * gsd_m

        comp_m = (cc_labels[y:y + bh, x:x + bw] == cid).astype(np.uint8)

        # If it's a realistic single building (area <= 500 m2 and max dim <= 36 m), KEEP IT WHOLE!
        if area_m2 <= 500.0 and dim_m <= 36.0:
            cnts, _ = cv2.findContours(comp_m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for sc in cnts:
                if cv2.contourArea(sc) >= min_area_px:
                    raw_contours.append(sc + np.array([[[x, y]]]))
            continue

        # If it's a massive cluster (area > 500 m2 or dim > 36 m), only separate at narrow geometric pinches
        pts_nz = cv2.findNonZero(comp_m)
        if pts_nz is not None:
            rect = cv2.minAreaRect(pts_nz)
            rw, rh = rect[1]
            fill = area / max(rw * rh, 1.0)
            # If it's a single large warehouse (high fill ratio), keep it whole!
            if fill >= 0.70:
                cnts, _ = cv2.findContours(comp_m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                for sc in cnts:
                    if cv2.contourArea(sc) >= min_area_px:
                        raw_contours.append(sc + np.array([[[x, y]]]))
                continue

        # Otherwise, gentle morphological opening to separate touching adjacent houses at narrow bridges
        k_open = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        opened = cv2.morphologyEx(comp_m, cv2.MORPH_OPEN, k_open)
        sub_cnts, _ = cv2.findContours(opened, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        valid_sub = [sc for sc in sub_cnts if cv2.contourArea(sc) >= min_area_px]

        if len(valid_sub) >= 2:
            for sc in valid_sub:
                raw_contours.append(sc + np.array([[[x, y]]]))
        else:
            # Keep as single building
            cnts, _ = cv2.findContours(comp_m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for sc in cnts:
                if cv2.contourArea(sc) >= min_area_px:
                    raw_contours.append(sc + np.array([[[x, y]]]))

    # 3. Merging Stage: check for adjacent / touching sub-contours that belong to the same house
    pre_buildings = []
    for c in raw_contours:
        area_px = cv2.contourArea(c)
        if area_px < min_area_px:
            continue
        rect = cv2.minAreaRect(c)
        (cx, cy), (rw, rh), ang = rect
        if rw < rh:
            rw, rh = rh, rw
            ang = (ang + 90) % 180
        pre_buildings.append({
            "contour": c,
            "area_px": area_px,
            "center": (cx, cy),
            "dim": (rw, rh),
            "ang": ang
        })

    # Merge touching or nearly-touching fragments (distance <= 4px and combined area <= 450 m2)
    merged_buildings = []
    used = set()

    for i in range(len(pre_buildings)):
        if i in used:
            continue
        curr_cnt = pre_buildings[i]["contour"]
        curr_area = pre_buildings[i]["area_px"]
        cx_i, cy_i = pre_buildings[i]["center"]

        for j in range(i + 1, len(pre_buildings)):
            if j in used:
                continue
            cx_j, cy_j = pre_buildings[j]["center"]
            dist_centers = math.hypot(cx_i - cx_j, cy_i - cy_j)
            # If centers are very close (less than 18px), check if they form one building
            if dist_centers < 18.0:
                combined_area_m2 = (curr_area + pre_buildings[j]["area_px"]) * (gsd_m ** 2)
                if combined_area_m2 <= 450.0:
                    combined_pts = np.vstack([curr_cnt, pre_buildings[j]["contour"]])
                    hull = cv2.convexHull(combined_pts)
                    curr_cnt = hull
                    curr_area = cv2.contourArea(curr_cnt)
                    used.add(j)

        used.add(i)
        merged_buildings.append(curr_cnt)

    # 4. Shape Determination & Regularized Fitting
    final_buildings = []
    for idx, c in enumerate(merged_buildings):
        area_px = cv2.contourArea(c)
        if area_px < min_area_px:
            continue
        x, y, bw, bh = cv2.boundingRect(c)
        if bw < 2 or bh < 2:
            continue

        rect = cv2.minAreaRect(c)
        (cx, cy), (rw, rh), ang = rect
        if rw < rh:
            rw, rh = rh, rw
            ang = (ang + 90) % 180

        rect_area = max(rw * rh, 1.0)
        rectangularity = area_px / rect_area
        area_m2 = area_px * (gsd_m ** 2)
        bld_len_m = max(rw, rh) * gsd_m
        bld_wid_m = min(rw, rh) * gsd_m

        if area_m2 > 1600.0 or bld_len_m > 75.0 or bld_wid_m > 65.0:
            continue
        if bld_len_m / max(bld_wid_m, 0.5) > 4.5:
            continue

        # Predominant shape fitting
        if rectangularity >= 0.58 or (area_m2 <= 300.0 and rectangularity >= 0.50):
            poly = cv2.boxPoints(((cx, cy), (rw, rh), ang))
            shape_type = "Rectangle / Box"
        else:
            angle_rad = math.radians(ang)
            cos_a = math.cos(-angle_rad)
            sin_a = math.sin(-angle_rad)
            pts = c.reshape(-1, 2).astype(np.float32) - np.array([cx, cy])
            pts_rot = np.empty_like(pts)
            pts_rot[:, 0] = pts[:, 0] * cos_a - pts[:, 1] * sin_a
            pts_rot[:, 1] = pts[:, 0] * sin_a + pts[:, 1] * cos_a
            cnt_rot = pts_rot.reshape(-1, 1, 2).astype(np.int32)
            peri = cv2.arcLength(cnt_rot, True)
            approx_rot = cv2.approxPolyDP(cnt_rot, max(1.5, 0.025 * peri), True).reshape(-1, 2).astype(np.float32)
            if len(approx_rot) >= 4:
                cos_b = math.cos(angle_rad)
                sin_b = math.sin(angle_rad)
                poly = np.empty_like(approx_rot)
                poly[:, 0] = approx_rot[:, 0] * cos_b - approx_rot[:, 1] * sin_b + cx
                poly[:, 1] = approx_rot[:, 0] * sin_b + approx_rot[:, 1] * cos_b + cy
                shape_type = "Orthogonal L/T-Shape"
            else:
                poly = cv2.boxPoints(((cx, cy), (rw, rh), ang))
                shape_type = "Rectangle / Box"

        final_buildings.append({
            "id": f"BLD-{idx+1:03d}",
            "center_px": [round(float(cx), 1), round(float(cy), 1)],
            "area_m2": round(area_m2, 1),
            "shape_type": shape_type,
            "poly": np.round(poly, 1).tolist()
        })

    return final_buildings

pipe = GeoDepthPipeline()
img_path = os.path.join("backend", "uploads", "sapporo_district.jpg")
img_bgr = cv2.imread(img_path)
img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

seg, hgt, gsd = pipe.infer_adaptive_multiscale(img_rgb, initial_gsd_m=0.25)
auto_gsd, _, _ = pipe.estimate_auto_gsd(img_rgb, seg, default_gsd=gsd)

blds = extract_holistic_buildings(seg, hgt, img_rgb, gsd_m=auto_gsd)
print(f"Extracted {len(blds)} holistic buildings.")

# Check close pairs again
centers = np.array([b["center_px"] for b in blds])
close = 0
for i in range(len(blds)):
    for j in range(i + 1, len(blds)):
        if np.linalg.norm(centers[i] - centers[j]) < 15.0:
            close += 1

print(f"Close pairs (<15px) now: {close} (previously was 229!)")
rect_count = sum(1 for b in blds if b["shape_type"] == "Rectangle / Box")
l_count = sum(1 for b in blds if b["shape_type"] == "Orthogonal L/T-Shape")
print(f"Shape distribution: {rect_count} Rectangular Boxes, {l_count} Orthogonal L/T-Shapes.")
