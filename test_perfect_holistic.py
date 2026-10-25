import os, cv2, torch, math, numpy as np
import shapely, shapely.geometry as sg
from backend.core.geodepth_pipeline import GeoDepthPipeline
from backend.core.preprocessor import detect_map_ui_chrome, detect_map_vector_roads

pipe = GeoDepthPipeline(ckpt_path='E:/height-model/height_v2.pt')

def perfect_extract(img_path, nominal_gsd, out_name):
    bgr = cv2.imread(img_path)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h_img, w_img = bgr.shape[:2]

    ui_mask = detect_map_ui_chrome(rgb)
    road_mask = detect_map_vector_roads(rgb)

    # 1. Neural inference & scale auto-tuning
    seg, hgt, auto_gsd = pipe.infer_adaptive_multiscale(rgb, initial_gsd_m=nominal_gsd)
    eff_gsd = auto_gsd if auto_gsd else nominal_gsd

    # Relative nDSM
    k_px = int(round(32.0 / max(eff_gsd, 0.15)))
    if k_px % 2 == 0: k_px += 1
    local_ground = cv2.morphologyEx(hgt, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_px, k_px)))
    ndsm = np.maximum(0.0, hgt - local_ground)

    # 2. Multi-Modal Building Surface:
    # Neural building class (seg == 2) is primary ground truth.
    # Spectral roof recovery for Asian blue metal & terracotta tiles where nDSM is elevated.
    r = rgb[..., 0].astype(float)
    g = rgb[..., 1].astype(float)
    b = rgb[..., 2].astype(float)
    blue_roof = (b > r + 14) & (b > g * 0.94) & (b > 65) & (ndsm >= 1.6)
    red_roof = (r > g + 16) & (r > b + 16) & (r > 65) & (ndsm >= 1.6)
    veg = (g > r + 10) & (g > b)

    is_bld = ((seg == 2) | blue_roof | red_roof) & (seg != 1) & (seg != 4) & (~veg)
    is_bld = is_bld & (road_mask == 0) & (ui_mask == 0)
    bld_mask = is_bld.astype(np.uint8)

    # Morphological closing to seal roof ridges, chimneys, and dormers
    close_k = max(3, int(round(2.2 / max(eff_gsd, 0.15))))
    if close_k % 2 == 0: close_k += 1
    k_close = cv2.getStructuringElement(cv2.MORPH_RECT, (close_k, close_k))
    bld_mask = cv2.morphologyEx(bld_mask, cv2.MORPH_CLOSE, k_close)

    # Minimum building area: residential house is >= 28 m2
    min_area_m2 = 28.0
    min_area_px = max(16, int(round(min_area_m2 / max(eff_gsd ** 2, 0.04))))

    # 3. Controlled Distance Peaks for Distinct Houses
    dist = cv2.distanceTransform(bld_mask, cv2.DIST_L2, 5)

    # Minimum separation between distinct houses: 5.2 meters
    peak_r = max(5, int(round(5.2 / max(eff_gsd, 0.15))))
    k_peak = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (peak_r * 2 + 1, peak_r * 2 + 1))
    dilated = cv2.dilate(dist, k_peak)

    peaks = (dist == dilated) & (dist >= max(2.5, 0.15 * dist.max())) & (bld_mask > 0)
    num_markers, markers = cv2.connectedComponents(peaks.astype(np.uint8))

    # Watershed along physical building eaves
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    bi = cv2.bilateralFilter(gray, 5, 35, 35)
    grad = cv2.morphologyEx(bi, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    grad_bgr = cv2.cvtColor(grad, cv2.COLOR_GRAY2BGR)

    markers_ws = markers.copy()
    markers_ws[bld_mask == 0] = -1
    cv2.watershed(grad_bgr, markers_ws)

    # 4. Predominant Shape Fitting
    min_w_px = max(4.0, 3.8 / max(eff_gsd, 0.15)) # House width >= 3.8m
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
        if min(rw, rh) < min_w_px:
            continue
        if max(rw, rh) / max(min(rw, rh), 1.0) > 7.0:
            continue

        # Physical axis via second central moments
        M = cv2.moments(c)
        if M['m00'] > 0:
            mu20 = M['mu20'] / M['m00']
            mu02 = M['mu02'] / M['m00']
            mu11 = M['mu11'] / M['m00']
            inertia_ang = math.degrees(0.5 * math.atan2(2 * mu11, mu20 - mu02))
            diff = (ang - inertia_ang) % 90
            if diff > 45: diff -= 90
            if abs(diff) < 22.0:
                ang = inertia_ang

        # Tight box with 4% setback margin
        rw_fit = max(min_w_px, rw * 0.96)
        rh_fit = max(min_w_px, rh * 0.96)
        box = cv2.boxPoints(((cx, cy), (rw_fit, rh_fit), ang))

        # Check rectangularity
        rectangularity = c_area / max(rw * rh, 1.0)
        shape_type = "Rectangle" if rectangularity >= 0.65 else "Polygon"

        raw_candidates.append({
            "box": box,
            "cx": cx,
            "cy": cy,
            "rw": rw_fit,
            "rh": rh_fit,
            "ang": ang,
            "area_px": c_area,
            "shape_type": shape_type
        })

    # 5. Strict NMS: One building = exactly one polygon (Zero Overlap / Duplicate)
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
                if ratio > 0.15:
                    is_dup = True
                    break
        if not is_dup:
            accepted.append(item)
            accepted_polys.append(poly)

    print(f"[{os.path.basename(img_path)}] Detected: {len(accepted)} clean, distinct houses/buildings")

    # Draw overlay
    vis = bgr.copy()
    for b in accepted:
        pts = np.round(b["box"]).astype(np.int32)
        cv2.polylines(vis, [pts], isClosed=True, color=(0, 255, 0), thickness=2)
        cx, cy = int(b["cx"]), int(b["cy"])
        cv2.circle(vis, (cx, cy), 3, (0, 0, 255), -1)

    out_file = os.path.join(r'C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b', out_name)
    cv2.imwrite(out_file, vis)
    print(f"Saved {out_file}")

test_cases = [
    ('backend/uploads/e7008266-1bb9-45ec-87a2-048a7e3e86e2_c3bf614a-6b63-4e04-8ae1-e66488c0fc4b.jpeg', 0.35, 'perfect_japan_village.png'),
    ('backend/uploads/f608be20-00b7-49d7-8777-e46174344b19_CHINA IMAGE.png', 0.48, 'perfect_china_village.png'),
    ('backend/uploads/f84d9a79-dc6f-4fd6-8bb3-0e882cfc21fa_Japan Image.png', 0.28, 'perfect_sapporo_urban.png'),
    ('backend/uploads/e2855243-f8be-4225-bd1f-0cdf2b2be463_India Image.png', 0.35, 'perfect_india_settlement.png')
]

for p, gsd, out_f in test_cases:
    if os.path.exists(p):
        perfect_extract(p, gsd, out_f)
