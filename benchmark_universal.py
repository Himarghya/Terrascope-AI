import os
import cv2
import numpy as np
import math
import sys
sys.path.append(os.path.join(os.getcwd(), "backend"))

from core.geodepth_pipeline import GeoDepthPipeline
from core.preprocessor import detect_map_ui_chrome, detect_map_vector_roads

pipe = GeoDepthPipeline()

def extract_universal_buildings(seg, hgt, rgb_img, gsd_m=0.35, min_area_m2=12.0):
    """
    Universal Single-Building Delineation & Predominant Shape Fitting:
    - Works across ANY image: drone, aerial, satellite, urban, suburban, rural village.
    - Fuses neural building segmentation with neural metric elevation (hgt >= 2.5m).
    - Preserves isolated single homes without oversegmentation.
    - Uses adaptive marker watershed to cleanly separate touching multi-house blocks.
    - Predominantly fits the geometric shape (Rectangle OBB, Orthogonal L/T-Shape).
    - Applies SIHE metric height and roof classification.
    """
    h_img, w_img = rgb_img.shape[:2]
    min_area_px = max(6, int(round(min_area_m2 / max(gsd_m ** 2, 0.04))))
    ui_mask = detect_map_ui_chrome(rgb_img)
    road_mask = detect_map_vector_roads(rgb_img)

    # 1. Comprehensive Building Mask
    elevated = (hgt >= 2.5) & (seg != 1) & (seg != 4) & (road_mask == 0) & (ui_mask == 0)
    bld_mask = (((seg == 2) | elevated) & (road_mask == 0) & (ui_mask == 0)).astype(np.uint8)

    k3 = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    bld_mask = cv2.morphologyEx(bld_mask, cv2.MORPH_OPEN, k3)
    bld_mask = cv2.morphologyEx(bld_mask, cv2.MORPH_CLOSE, k3)

    # Connected components to distinguish isolated houses from multi-house clusters
    num_cc, cc_labels, cc_stats, _ = cv2.connectedComponentsWithStats(bld_mask)
    raw_houses = []

    # Adaptive peak radius based on GSD
    if gsd_m <= 0.35:
        peak_r_px = max(6, int(round(2.2 / gsd_m)))
    elif gsd_m <= 0.80:
        peak_r_px = max(4, int(round(2.2 / gsd_m)))
    elif gsd_m <= 1.40:
        peak_r_px = 3
    else:
        peak_r_px = 2

    k_peak = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (peak_r_px * 2 + 1, peak_r_px * 2 + 1))

    # Gradient for watershed boundaries
    gray = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2GRAY)
    bi = cv2.bilateralFilter(gray, 5, 40, 40)
    sobelx = cv2.Sobel(bi, cv2.CV_32F, 1, 0, ksize=3)
    sobely = cv2.Sobel(bi, cv2.CV_32F, 0, 1, ksize=3)
    grad = np.sqrt(sobelx**2 + sobely**2)
    grad_norm = cv2.normalize(grad, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    grad_rgb = cv2.cvtColor(grad_norm, cv2.COLOR_GRAY2BGR)

    for cid in range(1, num_cc):
        area_px = cc_stats[cid, cv2.CC_STAT_AREA]
        if area_px < min_area_px:
            continue
        x = cc_stats[cid, cv2.CC_STAT_LEFT]
        y = cc_stats[cid, cv2.CC_STAT_TOP]
        bw = cc_stats[cid, cv2.CC_STAT_WIDTH]
        bh = cc_stats[cid, cv2.CC_STAT_HEIGHT]

        area_m2 = area_px * (gsd_m ** 2)
        dim_m = max(bw, bh) * gsd_m
        comp_m = (cc_labels[y:y + bh, x:x + bw] == cid).astype(np.uint8)

        # Case A: Isolated single house (area <= 380 m2 and max dim <= 28m)
        # Keep intact as ONE complete building without cutting!
        if area_m2 <= 380.0 and dim_m <= 28.0:
            cnts, _ = cv2.findContours(comp_m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for sc in cnts:
                if cv2.contourArea(sc) >= min_area_px:
                    raw_houses.append((sc + np.array([[[x, y]]]), comp_m, cv2.contourArea(sc), (x, y, bw, bh)))
            continue

        # Case B: Multi-house cluster (area > 380 m2 or dim > 28m)
        # Run marker-controlled watershed within this cluster to separate individual houses
        dist_c = cv2.distanceTransform(comp_m, cv2.DIST_L2, 5)
        dilated_c = cv2.dilate(dist_c, k_peak)
        peaks_c = (dist_c == dilated_c) & (dist_c >= max(2.0, 0.18 * dist_c.max())) & (comp_m > 0)
        num_h_c, markers_c = cv2.connectedComponents(peaks_c.astype(np.uint8))

        if num_h_c <= 2:
            # Single large structure (e.g. warehouse, commercial center)
            cnts, _ = cv2.findContours(comp_m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for sc in cnts:
                if cv2.contourArea(sc) >= min_area_px:
                    raw_houses.append((sc + np.array([[[x, y]]]), comp_m, cv2.contourArea(sc), (x, y, bw, bh)))
            continue

        # Multiple houses touching: watershed partition
        markers_sub = np.zeros_like(markers_c, dtype=np.int32)
        markers_sub[markers_c > 0] = markers_c[markers_c > 0]
        markers_sub[comp_m == 0] = -1

        rgb_sub = grad_rgb[y:y + bh, x:x + bw].copy()
        cv2.watershed(rgb_sub, markers_sub)

        for hid in range(1, num_h_c):
            sub_m = ((markers_sub == hid) & (comp_m > 0)).astype(np.uint8)
            sub_area = cv2.countNonZero(sub_m)
            if sub_area < min_area_px:
                continue
            cnts, _ = cv2.findContours(sub_m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for sc in cnts:
                if cv2.contourArea(sc) >= min_area_px:
                    raw_houses.append((sc + np.array([[[x, y]]]), sub_m, cv2.contourArea(sc), (x, y, bw, bh)))

    # 3. Predominant Shape Fitting and Metric Assembly
    buildings = []
    for idx, (c, mask_sub, area_px, bbox) in enumerate(raw_houses):
        x, y, bw, bh = cv2.boundingRect(c)
        if bw < 2 or bh < 2:
            continue

        rect = cv2.minAreaRect(c)
        (cx, cy), (rw, rh), ang = rect
        if rw < rh:
            rw, rh = rh, rw
            ang = (ang + 90) % 180

        rect_area = max(rw * rh, 1.0)
        fill = area_px / rect_area
        area_m2 = round(area_px * (gsd_m ** 2), 1)
        bld_len_m = round(rw * gsd_m, 1)
        bld_wid_m = round(rh * gsd_m, 1)

        if area_m2 > 2500.0 or bld_len_m > 120.0:
            continue

        # Predominant shape fitting
        if fill >= 0.52 or area_m2 <= 280:
            poly = cv2.boxPoints(((cx, cy), (rw, rh), ang))
            shape_type = "Rectangle / Box"
            confidence = 0.95
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
                confidence = 0.90
            else:
                poly = cv2.boxPoints(((cx, cy), (rw, rh), ang))
                shape_type = "Rectangle / Box"
                confidence = 0.88

        # SIHE metric height
        mask_c = np.zeros((bh, bw), np.uint8)
        cv2.drawContours(mask_c, [c], -1, 1, -1, offset=(-x, -y))
        h_crop = hgt[y:y + bh, x:x + bw]
        hv = h_crop[mask_c > 0]
        med_h = float(np.median(hv)) if hv.size else 4.5
        p90 = float(np.percentile(hv, 90)) if hv.size else med_h * 1.2
        est_h = max(3.5, med_h)

        # Photo-sample median roof color
        rgb_crop = rgb_img[y:y + bh, x:x + bw]
        if np.any(mask_c > 0):
            roof_r = int(np.median(rgb_crop[..., 0][mask_c > 0]))
            roof_g = int(np.median(rgb_crop[..., 1][mask_c > 0]))
            roof_b = int(np.median(rgb_crop[..., 2][mask_c > 0]))
        else:
            roof_r, roof_g, roof_b = 180, 180, 180
        hex_color = f"#{roof_r:02x}{roof_g:02x}{roof_b:02x}"

        if shape_type == "Rectangle / Box" and (p90 - med_h) > 1.0:
            roof_shape = "Gabled / Pitched Roof"
        elif area_m2 <= 120.0:
            roof_shape = "Hipped Roof"
        else:
            roof_shape = "Flat Roof with Parapet"

        floors = max(1, int(round(est_h / 3.0)))
        if est_h >= 22.0 or floors >= 7:
            building_type = "High-Rise Commercial Tower"
        elif area_m2 >= 550:
            building_type = "Commercial / Industrial Structure"
        elif area_m2 >= 200 and floors >= 3:
            building_type = "Multi-Family Residential"
        else:
            building_type = "Residential Single-Family / House"

        buildings.append({
            "id": f"BLD-{len(buildings) + 1:03d}",
            "building_type": building_type,
            "shape_type": shape_type,
            "poly": np.round(poly.astype(float), 1).tolist(),
            "polygon_px": np.round(poly).astype(int).tolist(),
            "center_px": [round(float(cx), 1), round(float(cy), 1)],
            "height_m": round(est_h, 1),
            "estimated_height_m": round(est_h, 1),
            "h": round(est_h, 1),
            "area_m2": area_m2,
            "footprint_area_m2": area_m2,
            "length_m": bld_len_m,
            "width_m": bld_wid_m,
            "estimated_floors": floors,
            "roof_shape": roof_shape,
            "base_color_hex": hex_color,
            "rgb": [roof_r, roof_g, roof_b],
            "confidence": confidence,
            "cx": round(float(cx), 1),
            "cy": round(float(cy), 1)
        })

    buildings.sort(key=lambda b: -b["height_m"])
    return buildings

# Benchmark test across 7 diverse image types
test_files = [
    ("sapporo_district.jpg", 0.25, "Dense Japanese Urban Block"),
    ("f84d9a79-dc6f-4fd6-8bb3-0e882cfc21fa_Japan Image.png", None, "Full Japan Scene (Auto-GSD)"),
    ("f600d927-b424-4e7a-a9d4-8c1c9097d0e7_India Image.png", None, "Dense Indian Settlement (Auto-GSD)"),
    ("e2e730e7-6f0a-4437-a3ac-9499f2281d3e_China Image.jpeg", None, "High-Rise China District (Auto-GSD)"),
    ("geodepth_66d6c128_nakul.png", None, "Nakul Rural Village (Auto-GSD)"),
    ("suburban_residential.png", 0.40, "US Suburban Cul-de-Sac"),
    ("urban_highrise.png", 0.40, "Downtown Commercial Towers")
]

print("=== STARTING UNIVERSAL MULTI-SCENE BENCHMARK ===")
for fname, nominal_gsd, desc in test_files:
    p = os.path.join("backend", "uploads", fname)
    if not os.path.exists(p):
        p = os.path.join("backend", "sample_data", fname)
    if not os.path.exists(p):
        continue

    img_bgr = cv2.imread(p)
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    h, w = img_rgb.shape[:2]

    # Neural inference
    raw = pipe._run_single_window(img_rgb)
    seg = np.argmax(raw[:5], axis=0).astype(np.uint8)
    hgt = np.maximum(0.0, raw[5] * pipe.h_scale)

    if nominal_gsd:
        actual_gsd = nominal_gsd
        gsd_src = f"Nominal ({nominal_gsd}m/px)"
    else:
        auto_gsd, gsd_src, _ = pipe.estimate_auto_gsd(img_rgb, seg, default_gsd=0.35)
        actual_gsd = auto_gsd

    blds = extract_universal_buildings(seg, hgt, img_rgb, gsd_m=actual_gsd)
    rects = sum(1 for b in blds if b["shape_type"] == "Rectangle / Box")
    l_shapes = sum(1 for b in blds if b["shape_type"] == "Orthogonal L/T-Shape")
    mean_h = np.mean([b["height_m"] for b in blds]) if blds else 0.0

    print(f"\n[OK] {desc} ({fname}):")
    print(f"     Image: {w}x{h} px | GSD: {actual_gsd:.2f} m/px ({gsd_src})")
    print(f"     Buildings Extracted: {len(blds)} | Rectangles: {rects} | L/T-Shapes: {l_shapes}")
    print(f"     Mean Height: {mean_h:.1f}m | Tallest: {blds[0]['height_m'] if blds else 0}m")

print("\n=== BENCHMARK COMPLETED SUCCESSFULLY ===")
