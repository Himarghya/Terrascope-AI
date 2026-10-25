import cv2, numpy as np, math, os
import shapely, shapely.geometry as sg
from backend.core.geodepth_pipeline import GeoDepthPipeline
from backend.core.preprocessor import detect_map_ui_chrome, detect_map_vector_roads

pipe = GeoDepthPipeline(ckpt_path='E:/height-model/height_v2.pt')

def test_full_coverage(img_path, out_overlay_name):
    bgr = cv2.imread(img_path)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]

    ui_mask = detect_map_ui_chrome(rgb)
    road_mask = detect_map_vector_roads(rgb)

    seg, hgt, gsd_m = pipe.infer_adaptive_multiscale(rgb, initial_gsd_m=0.35)

    # Relative nDSM: local ground elevation via morphological opening
    k_px = int(round(30.0 / max(gsd_m, 0.15)))
    if k_px % 2 == 0: k_px += 1
    local_ground = cv2.morphologyEx(hgt, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_px, k_px)))
    ndsm = np.maximum(0.0, hgt - local_ground)

    # Multi-modal building surface:
    # 1. Neural building class (seg == 2)
    # 2. Elevated structure (ndsm >= 1.8 or hgt >= 2.5) outside trees (seg == 1), water (seg == 4), roads, and UI chrome
    # 3. Spectral signatures (blue metal, terracotta, dark slate)
    r = rgb[..., 0].astype(float)
    g = rgb[..., 1].astype(float)
    b = rgb[..., 2].astype(float)
    blue_roof = (b > r + 12) & (b > g * 0.92) & (b > 60)
    red_roof = (r > g + 12) & (r > b + 12) & (r > 60)
    veg = (g > r + 12) & (g > b)

    elevated = ((ndsm >= 1.6) | (hgt >= 2.4)) & (seg != 1) & (seg != 4) & (~veg)
    is_bld = ((seg == 2) | elevated | blue_roof | red_roof) & (seg != 4) & (seg != 1) & (~veg)
    is_bld = is_bld & (road_mask == 0) & (ui_mask == 0)
    bld_mask = is_bld.astype(np.uint8)

    # Clean small noise
    k3 = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    bld_mask = cv2.morphologyEx(bld_mask, cv2.MORPH_OPEN, k3)
    bld_mask = cv2.morphologyEx(bld_mask, cv2.MORPH_CLOSE, k3)

    # Distance transform & dense house peaks
    dist = cv2.distanceTransform(bld_mask, cv2.DIST_L2, 5)

    # Peak radius ~ 2.5m (so touching houses in dense villages are resolved)
    peak_r = max(3, int(round(2.5 / max(gsd_m, 0.15))))
    k_peak = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (peak_r * 2 + 1, peak_r * 2 + 1))
    dilated = cv2.dilate(dist, k_peak)

    # Peak threshold
    peaks = (dist == dilated) & (dist >= max(1.8, 0.08 * dist.max())) & (bld_mask > 0)
    num_markers, markers = cv2.connectedComponents(peaks.astype(np.uint8))

    # Watershed along image edges
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    bi = cv2.bilateralFilter(gray, 5, 35, 35)
    grad = cv2.morphologyEx(bi, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    grad_bgr = cv2.cvtColor(grad, cv2.COLOR_GRAY2BGR)

    markers_ws = markers.copy()
    markers_ws[bld_mask == 0] = -1
    cv2.watershed(grad_bgr, markers_ws)

    # Extract all houses
    min_area_px = max(8, int(round(12.0 / max(gsd_m ** 2, 0.04)))) # 12 m2 min
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
        if min(rw, rh) < 2.5:
            continue

        # Inset slightly for clean setback (3%)
        rw_fit = max(2.5, rw * 0.97)
        rh_fit = max(2.5, rh * 0.97)

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

        box = cv2.boxPoints(((cx, cy), (rw_fit, rh_fit), ang))

        # Predominant shape
        rectangularity = c_area / max(rw * rh, 1.0)
        shape_type = "Rectangle" if rectangularity >= 0.55 else "Polygon"

        raw_candidates.append({
            "box": box,
            "c": c,
            "cx": cx,
            "cy": cy,
            "area_px": c_area,
            "shape_type": shape_type
        })

    # Non-maximum suppression with 30% overlap ceiling (so tightly packed houses don't kill each other)
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
                if ratio > 0.35: # Only drop if truly overlapping by > 35%
                    is_dup = True
                    break
        if not is_dup:
            accepted.append(item)
            accepted_polys.append(poly)

    print(f"[{os.path.basename(img_path)}] Accepted: {len(accepted)} buildings (from {len(raw_candidates)} candidates)")

    vis = bgr.copy()
    for b in accepted:
        pts = np.round(b["box"]).astype(np.int32)
        cv2.polylines(vis, [pts], isClosed=True, color=(0, 255, 0), thickness=2)
        cx, cy = int(b["cx"]), int(b["cy"])
        cv2.circle(vis, (cx, cy), 2, (0, 0, 255), -1)

    out_file = os.path.join(r'C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b', out_overlay_name)
    cv2.imwrite(out_file, vis)
    print(f"Saved {out_file}")

test_full_coverage('backend/uploads/f600d927-b424-4e7a-a9d4-8c1c9097d0e7_India Image.png', 'test_dense_india_coverage.png')
test_full_coverage('backend/uploads/sapporo_district.jpg', 'test_dense_sapporo_coverage.png')
