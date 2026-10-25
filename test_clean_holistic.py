import cv2
import numpy as np
import shapely
import shapely.geometry as sg
import math

def test_pipeline(img_path, gsd_m, out_name, min_area_m2=28.0, peak_sep_m=5.0, overlap_thresh=0.15):
    bgr = cv2.imread(img_path)
    h_img, w_img = bgr.shape[:2]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

    # 1. Pipeline inference (neural + spectral)
    from backend.core.geodepth_pipeline import GeoDepthPipeline
    pipe = GeoDepthPipeline(ckpt_path='E:/height-model/height_v2.pt')
    seg, hgt, auto_gsd = pipe.infer_adaptive_multiscale(rgb, initial_gsd_m=gsd_m)
    eff_gsd = auto_gsd if auto_gsd else gsd_m

    # Relative nDSM
    k_px = int(round(30.0 / max(eff_gsd, 0.15)))
    if k_px % 2 == 0: k_px += 1
    local_ground = cv2.morphologyEx(hgt, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_px, k_px)))
    ndsm = np.maximum(0.0, hgt - local_ground)

    # Colors
    r = rgb[..., 0].astype(float)
    g = rgb[..., 1].astype(float)
    b = rgb[..., 2].astype(float)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]

    # Blue metal / painted roofs
    blue_roof = (b > r + 12) & (b > g * 0.92) & (b > 60)
    # Red / terracotta tile
    red_roof = (r > g + 14) & (r > b + 14) & (r > 60)
    # Dark slate / tile roofs
    dark_slate = (V < 95) & (S < 35) & (ndsm >= 1.5)
    # White / tin metal roofs
    bright_roof = (V > 165) & (S < 35) & (ndsm >= 1.5)
    # Vegetation
    veg = (g > r + 10) & (g > b)

    elevated = (ndsm >= 1.6) & (seg != 1) & (seg != 4) & (~veg)
    is_bld = ((seg == 2) | elevated | blue_roof | red_roof | dark_slate | bright_roof) & (seg != 4) & (~veg)
    bld_mask = is_bld.astype(np.uint8)

    # Seal roof seams and ridges
    k_close = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    bld_mask = cv2.morphologyEx(bld_mask, cv2.MORPH_CLOSE, k_close)

    # Minimum area in pixels
    min_area_px = max(16, int(round(min_area_m2 / max(eff_gsd ** 2, 0.04))))

    # Distance transform
    dist = cv2.distanceTransform(bld_mask, cv2.DIST_L2, 5)

    # Peak radius in pixels based on physical metric separation between distinct houses (e.g. 5.0 meters)
    peak_r = max(5, int(round(peak_sep_m / max(eff_gsd, 0.15))))
    k_peak = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (peak_r * 2 + 1, peak_r * 2 + 1))
    dilated = cv2.dilate(dist, k_peak)

    # Prominent house peaks
    peaks = (dist == dilated) & (dist >= max(2.5, 0.12 * dist.max())) & (bld_mask > 0)
    num_markers, markers = cv2.connectedComponents(peaks.astype(np.uint8))

    # Watershed along image edges
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    bi = cv2.bilateralFilter(gray, 5, 30, 30)
    grad = cv2.morphologyEx(bi, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    grad_bgr = cv2.cvtColor(grad, cv2.COLOR_GRAY2BGR)

    markers_ws = markers.copy()
    markers_ws[bld_mask == 0] = -1
    cv2.watershed(grad_bgr, markers_ws)

    # Extract building footprints
    raw_candidates = []
    for hid in range(1, num_markers):
        m = ((markers_ws == hid) & (bld_mask > 0)).astype(np.uint8)
        area_px = cv2.countNonZero(m)
        if area_px < min_area_px:
            continue
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not cnts:
            continue
        c = max(cnts, key=cv2.contourArea)
        c_area = cv2.contourArea(c)
        if c_area < min_area_px:
            continue

        rect = cv2.minAreaRect(c)
        (cx, cy), (rw, rh), ang = rect
        if min(rw, rh) < 3.5:
            continue

        # Check aspect ratio
        if max(rw, rh) / max(min(rw, rh), 1.0) > 7.0:
            continue

        # Moment of inertia for roof orientation
        M = cv2.moments(c)
        if M['m00'] > 0:
            mu20 = M['mu20'] / M['m00']
            mu02 = M['mu02'] / M['m00']
            mu11 = M['mu11'] / M['m00']
            inertia_ang = math.degrees(0.5 * math.atan2(2 * mu11, mu20 - mu02))
            diff = (ang - inertia_ang) % 90
            if diff > 45: diff -= 90
            if abs(diff) < 25.0:
                ang = inertia_ang

        # Tight box fit with 5% setback margin
        rw_fit = max(3.5, rw * 0.95)
        rh_fit = max(3.5, rh * 0.95)
        box = cv2.boxPoints(((cx, cy), (rw_fit, rh_fit), ang))

        rectangularity = c_area / max(rw * rh, 1.0)
        shape_type = "Rectangle" if rectangularity >= 0.65 else "Polygon"

        raw_candidates.append({
            "box": box,
            "c": c,
            "cx": cx,
            "cy": cy,
            "rw": rw_fit,
            "rh": rh_fit,
            "ang": ang,
            "area_px": c_area,
            "shape_type": shape_type
        })

    # Strict NMS: Sort descending by area. Reject if overlap > overlap_thresh
    raw_candidates.sort(key=lambda x: -x["area_px"])
    accepted = []
    accepted_polys = []

    for item in raw_candidates:
        poly = sg.Polygon(item["box"])
        if not poly.is_valid:
            poly = shapely.make_valid(poly)
            if poly.geom_type == 'MultiPolygon':
                poly = max(poly.geoms, key=lambda g: g.area)
        if poly.geom_type != 'Polygon' or poly.area < min_area_px:
            continue

        is_dup = False
        for acc in accepted_polys:
            if acc.intersects(poly):
                inter = acc.intersection(poly).area
                ratio = inter / min(poly.area, acc.area)
                if ratio > overlap_thresh:
                    is_dup = True
                    break
        if not is_dup:
            accepted.append(item)
            accepted_polys.append(poly)

    print(f"[{out_name}] Raw candidates: {len(raw_candidates)} -> Final accepted: {len(accepted)}")

    # Draw overlay
    vis = bgr.copy()
    for b in accepted:
        pts = np.round(b["box"]).astype(np.int32)
        cv2.polylines(vis, [pts], isClosed=True, color=(0, 255, 0), thickness=2)
        cx, cy = int(b["cx"]), int(b["cy"])
        cv2.circle(vis, (cx, cy), 3, (0, 0, 255), -1)

    out_file = 'C:/Users/himar/.gemini/antigravity/brain/76000530-86a8-45e1-935b-a83dce89150b/' + out_name
    cv2.imwrite(out_file, vis)
    print(f"Saved {out_file}")

test_pipeline('backend/uploads/e7008266-1bb9-45ec-87a2-048a7e3e86e2_c3bf614a-6b63-4e04-8ae1-e66488c0fc4b.jpeg', 0.35, 'verified_japan_village_clean.png', min_area_m2=25.0, peak_sep_m=4.5, overlap_thresh=0.15)
test_pipeline('backend/uploads/f608be20-00b7-49d7-8777-e46174344b19_CHINA IMAGE.png', 0.48, 'verified_china_village_clean.png', min_area_m2=22.0, peak_sep_m=4.0, overlap_thresh=0.15)
