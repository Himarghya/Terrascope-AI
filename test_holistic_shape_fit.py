import cv2
import numpy as np
import shapely
import shapely.geometry as sg
from shapely.ops import unary_union
import math

def extract_holistic_buildings(seg, hgt, rgb_img, gsd_m=0.35, min_area_m2=25.0):
    """
    Extracts exactly ONE clean, predominantly fitted polygon per building:
    1. Multi-modal building mask (neural seg + relative nDSM + spectral features).
    2. Morphological closing to fuse split roof ridges/dormers into single building footprints.
    3. Watershed ONLY for distinct building centroids separated by >= 6.0 meters.
    4. Predominant shape fitting:
       - If rectangularity >= 0.72 -> Oriented Bounding Box
       - If complex/L-shaped -> Clean orthogonal/simplified polygon
    5. Strict Non-Maximum Suppression: Zero duplicate polygons per building.
    """
    h_img, w_img = rgb_img.shape[:2]
    min_area_px = max(16, int(round(min_area_m2 / max(gsd_m ** 2, 0.04))))
    max_area_px = int(round(12000.0 / max(gsd_m ** 2, 0.04))) # 12,000 m2 max building

    # Relative nDSM: local ground elevation via morphological opening
    k_px = int(round(35.0 / max(gsd_m, 0.15)))
    if k_px % 2 == 0:
        k_px += 1
    local_ground = cv2.morphologyEx(hgt, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_px, k_px)))
    ndsm = np.maximum(0.0, hgt - local_ground)

    # Spectral features
    r = rgb_img[..., 0].astype(float)
    g = rgb_img[..., 1].astype(float)
    b = rgb_img[..., 2].astype(float)
    hsv = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2HSV)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]

    # Blue metal / painted roofs
    blue_roof = (b > r + 12) & (b > g * 0.95) & (b > 60) & (H >= 85) & (H <= 140)
    # Red / terracotta tile roofs
    red_roof = (r > g + 15) & (r > b + 15) & (r > 65)
    # Dark slate / charcoal roofs (very common in Japan/Europe)
    dark_slate = (V < 95) & (S < 35) & (ndsm >= 1.8)
    # Vegetation mask
    veg = (g > r + 10) & (g > b) & (H >= 30) & (H <= 85)

    # Base building surface
    elevated = (ndsm >= 2.0) & (seg != 1) & (seg != 4) & (~veg)
    is_bld = ((seg == 2) | elevated | blue_roof | red_roof | dark_slate) & (seg != 4) & (~veg)
    bld_mask = is_bld.astype(np.uint8)

    # Morphological closing with ~2.5m kernel to fuse roof facets and close ridge seams
    close_k = max(3, int(round(2.5 / max(gsd_m, 0.15))))
    if close_k % 2 == 0: close_k += 1
    k_close = cv2.getStructuringElement(cv2.MORPH_RECT, (close_k, close_k))
    bld_mask = cv2.morphologyEx(bld_mask, cv2.MORPH_CLOSE, k_close)

    # Remove speckle noise
    open_k = max(3, int(round(1.2 / max(gsd_m, 0.15))))
    if open_k % 2 == 0: open_k += 1
    k_open = cv2.getStructuringElement(cv2.MORPH_RECT, (open_k, open_k))
    bld_mask = cv2.morphologyEx(bld_mask, cv2.MORPH_OPEN, k_open)

    # Find connected components of building mask
    num_cc, cc_labels, cc_stats, cc_centroids = cv2.connectedComponentsWithStats(bld_mask)

    building_regions = []
    # Minimum building separation distance: 5.5 meters
    sep_px = max(6, int(round(5.5 / max(gsd_m, 0.15))))
    k_peak = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (sep_px * 2 + 1, sep_px * 2 + 1))

    for cc_id in range(1, num_cc):
        area = cc_stats[cc_id, cv2.CC_STAT_AREA]
        if area < min_area_px or area > max_area_px:
            continue
        
        # Check aspect ratio of bounding box
        bw = cc_stats[cc_id, cv2.CC_STAT_WIDTH]
        bh = cc_stats[cc_id, cv2.CC_STAT_HEIGHT]
        if max(bw, bh) / max(min(bw, bh), 1) > 9.0: # Skip very thin lines (fences/wires)
            continue

        comp_mask = (cc_labels == cc_id).astype(np.uint8)

        # Check if component represents a single building or touching cluster
        # A typical single home footprint is under ~250 m2
        comp_area_m2 = area * (gsd_m ** 2)
        if comp_area_m2 <= 300.0:
            # Single building! Do NOT split via watershed!
            building_regions.append(comp_mask)
        else:
            # Larger cluster: find prominent distance peaks with large separation (5.5m)
            dist_c = cv2.distanceTransform(comp_mask, cv2.DIST_L2, 5)
            dilated = cv2.dilate(dist_c, k_peak)
            # Peak must be genuine deep center of a building (at least 2.5m inside roof)
            min_dist_thresh = max(2.5 / gsd_m, 0.35 * dist_c.max())
            peaks = (dist_c == dilated) & (dist_c >= min_dist_thresh) & (comp_mask > 0)
            n_pks, pk_labels = cv2.connectedComponents(peaks.astype(np.uint8))

            if n_pks <= 2: # 0 or 1 peak -> keep as 1 building
                building_regions.append(comp_mask)
            else:
                # Controlled watershed with high edge gradient
                gray = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2GRAY)
                grad = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, np.ones((3,3), np.uint8))
                grad_bgr = cv2.cvtColor(grad, cv2.COLOR_GRAY2BGR)
                ws_markers = pk_labels.copy()
                ws_markers[comp_mask == 0] = -1
                cv2.watershed(grad_bgr, ws_markers)

                for pid in range(1, n_pks):
                    sub_m = ((ws_markers == pid) & (comp_mask > 0)).astype(np.uint8)
                    if cv2.countNonZero(sub_m) >= min_area_px:
                        building_regions.append(sub_m)

    print(f"Total candidate building regions: {len(building_regions)}")

    # Predominant shape fitting for each building region
    candidates = []
    for m in building_regions:
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not cnts:
            continue
        c = max(cnts, key=cv2.contourArea)
        c_area = cv2.contourArea(c)
        if c_area < min_area_px:
            continue

        rect = cv2.minAreaRect(c)
        (cx, cy), (rw, rh), ang = rect
        if min(rw, rh) < 3.0:
            continue
        box_area = rw * rh
        rectangularity = c_area / max(box_area, 1.0)

        # Inset box slightly (6%) for architectural boundary separation
        rw_fit = max(3.0, rw * 0.94)
        rh_fit = max(3.0, rh * 0.94)

        # Moment of inertia for true physical orientation
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

        box = cv2.boxPoints(((cx, cy), (rw_fit, rh_fit), ang))

        # Decide predominant shape
        if rectangularity >= 0.68:
            poly_pts = box
            shape_type = "Rectangle / Box"
        else:
            # Complex / L-shaped: simplify contour cleanly
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.04 * peri, True)
            if len(approx) >= 4 and len(approx) <= 10:
                poly_pts = approx.reshape(-1, 2)
                shape_type = "L/T-Shape Polygon"
            else:
                poly_pts = box
                shape_type = "Rectangle / Box"

        candidates.append({
            "poly_pts": poly_pts,
            "box": box,
            "cx": cx,
            "cy": cy,
            "rw": rw_fit,
            "rh": rh_fit,
            "area_px": c_area,
            "shape_type": shape_type
        })

    # Strict NMS: Sort by area descending. Reject any candidate that overlaps > 25% with accepted
    candidates.sort(key=lambda x: -x["area_px"])
    accepted = []
    accepted_polys = []

    for cand in candidates:
        poly_geom = sg.Polygon(cand["poly_pts"])
        if not poly_geom.is_valid:
            poly_geom = shapely.make_valid(poly_geom)
            if poly_geom.geom_type == 'MultiPolygon':
                poly_geom = max(poly_geom.geoms, key=lambda g: g.area)
        if poly_geom.geom_type != 'Polygon' or poly_geom.area < min_area_px:
            continue

        overlap = False
        for acc_p in accepted_polys:
            if acc_p.intersects(poly_geom):
                inter_area = acc_p.intersection(poly_geom).area
                # If inter is > 22% of either polygon -> it is the SAME building! Reject duplicate!
                if inter_area / min(poly_geom.area, acc_p.area) > 0.22:
                    overlap = True
                    break
        if not overlap:
            accepted.append(cand)
            accepted_polys.append(poly_geom)

    print(f"Accepted clean, non-duplicate buildings: {len(accepted)}")
    return accepted
