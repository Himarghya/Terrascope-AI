import cv2
import numpy as np
import shapely, shapely.geometry as sg
import math

def test_pure_building_extraction(img_path, gsd_m, out_name):
    from backend.core.geodepth_pipeline import GeoDepthPipeline
    pipe = GeoDepthPipeline(ckpt_path='E:/height-model/height_v2.pt')

    bgr = cv2.imread(img_path)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h_img, w_img = bgr.shape[:2]

    # Run neural inference
    seg, hgt, auto_gsd = pipe.infer_adaptive_multiscale(rgb, initial_gsd_m=gsd_m)
    eff_gsd = auto_gsd if auto_gsd else gsd_m

    # Neural building mask
    bld_mask = (seg == 2).astype(np.uint8)

    # In case neural model missed blue metal roofs or terracotta roofs on non-US images,
    # add spectral roofs ONLY if they have elevated height (ndsm >= 2.0)
    k_px = int(round(30.0 / max(eff_gsd, 0.15)))
    if k_px % 2 == 0: k_px += 1
    local_ground = cv2.morphologyEx(hgt, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_px, k_px)))
    ndsm = np.maximum(0.0, hgt - local_ground)

    r = rgb[..., 0].astype(float)
    g = rgb[..., 1].astype(float)
    b = rgb[..., 2].astype(float)
    blue_roof = (b > r + 15) & (b > g * 0.95) & (b > 70) & (ndsm >= 1.5)
    red_roof = (r > g + 15) & (r > b + 15) & (r > 70) & (ndsm >= 1.5)
    bld_mask = np.maximum(bld_mask, (blue_roof | red_roof).astype(np.uint8))

    # Gentle morphological close to fuse roof ridges and panels into ONE unified house
    k_close = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    bld_mask = cv2.morphologyEx(bld_mask, cv2.MORPH_CLOSE, k_close)

    # Minimum area: residential house is >= 25 m2
    min_area_m2 = 25.0
    min_area_px = max(16, int(round(min_area_m2 / max(eff_gsd ** 2, 0.04))))

    # Find external contours of unified building components
    cnts, _ = cv2.findContours(bld_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    accepted_polys = []
    accepted_items = []

    for c in cnts:
        area_px = cv2.contourArea(c)
        if area_px < min_area_px:
            continue

        rect = cv2.minAreaRect(c)
        (cx, cy), (rw, rh), ang = rect

        # Minimum width of a building is at least 3.5 meters
        min_w_px = 3.5 / max(eff_gsd, 0.15)
        if min(rw, rh) < min_w_px:
            continue

        # Skip long thin linear structures (fences, wires, road strips)
        aspect = max(rw, rh) / max(min(rw, rh), 1.0)
        if aspect > 7.0:
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

        # Setback factor: inset slightly (4%) so adjacent houses don't touch
        rw_fit = max(min_w_px, rw * 0.96)
        rh_fit = max(min_w_px, rh * 0.96)
        box = cv2.boxPoints(((cx, cy), (rw_fit, rh_fit), ang))

        # Check rectangularity
        rectangularity = area_px / max(rw * rh, 1.0)
        if rectangularity >= 0.65:
            poly_pts = box
            shape_type = "Rectangle"
        else:
            # L-shaped or T-shaped house
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.035 * peri, True)
            if 4 <= len(approx) <= 10:
                poly_pts = approx.reshape(-1, 2)
                shape_type = "L/T-Shape Polygon"
            else:
                poly_pts = box
                shape_type = "Rectangle"

        poly_geom = sg.Polygon(poly_pts)
        if not poly_geom.is_valid:
            poly_geom = shapely.make_valid(poly_geom)
            if poly_geom.geom_type == 'MultiPolygon':
                poly_geom = max(poly_geom.geoms, key=lambda g: g.area)

        if poly_geom.geom_type != 'Polygon' or poly_geom.area < min_area_px:
            continue

        # NMS check: reject if overlapping > 15% with already accepted building
        is_dup = False
        for acc_p in accepted_polys:
            if acc_p.intersects(poly_geom):
                inter = acc_p.intersection(poly_geom).area
                if inter / min(poly_geom.area, acc_p.area) > 0.15:
                    is_dup = True
                    break
        if not is_dup:
            accepted_polys.append(poly_geom)
            accepted_items.append({
                "poly_pts": poly_pts,
                "cx": cx,
                "cy": cy,
                "shape_type": shape_type,
                "area_m2": round(area_px * (eff_gsd ** 2), 1)
            })

    print(f"[{out_name}] Detected {len(accepted_items)} individual houses/buildings")

    vis = bgr.copy()
    for item in accepted_items:
        pts = np.round(item["poly_pts"]).astype(np.int32)
        color = (0, 255, 0) if item["shape_type"] == "Rectangle" else (0, 215, 255)
        cv2.polylines(vis, [pts], isClosed=True, color=color, thickness=2)
        cx, cy = int(item["cx"]), int(item["cy"])
        cv2.circle(vis, (cx, cy), 3, (0, 0, 255), -1)

    out_path = 'C:/Users/himar/.gemini/antigravity/brain/76000530-86a8-45e1-935b-a83dce89150b/' + out_name
    cv2.imwrite(out_path, vis)
    print(f"Saved {out_path}")

test_pure_building_extraction('backend/uploads/e7008266-1bb9-45ec-87a2-048a7e3e86e2_c3bf614a-6b63-4e04-8ae1-e66488c0fc4b.jpeg', 0.35, 'test_japan_village_pure.png')
test_pure_building_extraction('backend/uploads/f608be20-00b7-49d7-8777-e46174344b19_CHINA IMAGE.png', 0.48, 'test_china_village_pure.png')
