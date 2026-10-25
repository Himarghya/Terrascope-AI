import cv2
import math
import numpy as np
import shapely
import shapely.geometry as sg
from backend.core.geodepth_pipeline import GeoDepthPipeline
from backend.core.preprocessor import detect_map_ui_chrome, detect_map_vector_roads


def compute_dominant_roof_angle(contour: np.ndarray, gx: np.ndarray, gy: np.ndarray) -> float:
    rect = cv2.minAreaRect(contour)
    (_, _), (rw, rh), rect_ang = rect
    if rw < rh:
        rect_ang = (rect_ang + 90.0) % 180.0
    base_ang90 = rect_ang % 90.0

    hist = np.zeros(90, dtype=np.float64)

    peri = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, max(1.5, 0.018 * peri), True).reshape(-1, 2)
    if len(approx) >= 3:
        for i in range(len(approx)):
            p1 = approx[i]
            p2 = approx[(i + 1) % len(approx)]
            dx = float(p2[0] - p1[0])
            dy = float(p2[1] - p1[1])
            seg_len = math.hypot(dx, dy)
            if seg_len >= 3.0:
                ang = math.degrees(math.atan2(dy, dx)) % 90.0
                bin_idx = int(round(ang)) % 90
                hist[bin_idx] += seg_len * 3.0

    mag = np.hypot(gx, gy)
    valid = mag > np.percentile(mag, 60) if mag.size > 0 else np.zeros_like(mag, dtype=bool)
    if np.any(valid):
        angs = (np.degrees(np.arctan2(gy[valid], gx[valid])) + 90.0) % 90.0
        wts = mag[valid]
        bins = np.floor(angs).astype(np.int32) % 90
        np.add.at(hist, bins, wts * 0.20)

    hist_pad = np.concatenate([hist[-4:], hist, hist[:4]])
    kernel = np.array([0.1, 0.25, 0.5, 0.8, 1.0, 0.8, 0.5, 0.25, 0.1])
    hist_smooth = np.convolve(hist_pad, kernel, mode='valid')

    if np.max(hist_smooth) > 0:
        best_ang90 = float(np.argmax(hist_smooth))
        diff = abs(best_ang90 - base_ang90)
        diff = min(diff, 90.0 - diff)
        if diff <= 28.0:
            if abs((rect_ang % 90.0) - best_ang90) <= 45.0:
                return rect_ang - (rect_ang % 90.0) + best_ang90
            else:
                return (rect_ang - (rect_ang % 90.0) + best_ang90 + 90.0) % 180.0

    return float(rect_ang)


def clean_rectilinear_vertices(pts_uv: np.ndarray, min_step: float) -> np.ndarray:
    """
    Removes collinear vertices and eliminates tiny stair-step jogs shorter than min_step
    in axis-aligned (u, v) coordinates so L/T/U shapes have crisp architectural corners.
    """
    pts = [p.copy() for p in pts_uv]
    for _ in range(3):
        if len(pts) <= 4:
            break
        cleaned = []
        n = len(pts)
        i = 0
        while i < n:
            p_prev = pts[(i - 1) % n]
            p_curr = pts[i]
            p_next = pts[(i + 1) % n]
            seg_len = float(np.linalg.norm(p_next - p_curr))
            if seg_len < min_step and len(pts) > 4:
                # Skip tiny jog
                i += 1
                continue
            # Check collinearity with prev and next
            v1 = p_curr - p_prev
            v2 = p_next - p_curr
            n1 = float(np.linalg.norm(v1))
            n2 = float(np.linalg.norm(v2))
            if n1 > 1e-4 and n2 > 1e-4:
                cross = abs(v1[0] * v2[1] - v1[1] * v2[0]) / (n1 * n2)
                if cross < 0.08:
                    i += 1
                    continue
            cleaned.append(p_curr)
            i += 1
        pts = cleaned
        if len(pts) < 4:
            break

    # Snap consecutive points to strict horizontal/vertical alignment
    if len(pts) >= 4:
        n = len(pts)
        for i in range(n):
            p_curr = pts[i]
            p_next = pts[(i + 1) % n]
            if abs(p_next[0] - p_curr[0]) < abs(p_next[1] - p_curr[1]):
                avg_u = 0.5 * (p_curr[0] + p_next[0])
                p_curr[0] = avg_u
                p_next[0] = avg_u
            else:
                avg_v = 0.5 * (p_curr[1] + p_next[1])
                p_curr[1] = avg_v
                p_next[1] = avg_v

    return np.array(pts, dtype=np.float32)


def fit_orthogonal_polygon(mask_crop: np.ndarray, x0: int, y0: int, cx: float, cy: float, angle_deg: float, gsd_m: float):
    ys, xs = np.nonzero(mask_crop)
    if len(xs) < 8:
        return np.array([]), "Rectangle / Box", 0.0, 0.0

    pts_x = xs.astype(np.float32) + x0 - cx
    pts_y = ys.astype(np.float32) + y0 - cy

    rad = math.radians(-angle_deg)
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    u = pts_x * cos_a - pts_y * sin_a
    v = pts_x * sin_a + pts_y * cos_a

    u_min, u_max = np.percentile(u, [1.5, 98.5])
    v_min, v_max = np.percentile(v, [1.5, 98.5])
    rw = max(float(u_max - u_min), 2.5)
    rh = max(float(v_max - v_min), 2.5)

    area_px = float(len(xs))
    area_m2 = area_px * (gsd_m ** 2)
    fill_ratio = area_px / max(rw * rh, 1.0)

    # Fit orthogonal L/T/U polygon ONLY for genuine medium-to-large multi-wing buildings
    if fill_ratio < 0.70 and area_m2 >= 135.0 and min(rw, rh) * gsd_m >= 6.8:
        cell_px = max(2.5, min(rw, rh) / 10.0, 2.2 / max(gsd_m, 0.15))
        gw = int(math.ceil(rw / cell_px)) + 4
        gh = int(math.ceil(rh / cell_px)) + 4
        if 5 <= gw <= 180 and 5 <= gh <= 180:
            grid = np.zeros((gh, gw), dtype=np.uint8)
            gu = np.clip(np.round((u - u_min) / cell_px).astype(np.int32) + 2, 0, gw - 1)
            gv = np.clip(np.round((v - v_min) / cell_px).astype(np.int32) + 2, 0, gh - 1)
            grid[gv, gu] = 255

            grid = cv2.morphologyEx(grid, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
            grid = cv2.morphologyEx(grid, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))

            cnts, _ = cv2.findContours(grid, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if cnts:
                c_grid = max(cnts, key=cv2.contourArea)
                peri = cv2.arcLength(c_grid, True)
                for eps_factor in [0.028, 0.038, 0.05, 0.065]:
                    approx = cv2.approxPolyDP(c_grid, max(1.1, eps_factor * peri), True).reshape(-1, 2).astype(np.float32)
                    if 4 <= len(approx) <= 10:
                        break

                if len(approx) >= 4:
                    ortho_pts = []
                    n_p = len(approx)
                    for i in range(n_p):
                        p_curr = approx[i].copy()
                        p_next = approx[(i + 1) % n_p]
                        ortho_pts.append(p_curr)
                        dx = abs(p_next[0] - p_curr[0])
                        dy = abs(p_next[1] - p_curr[1])
                        if dx >= 1.2 and dy >= 1.2:
                            ortho_pts.append(np.array([p_next[0], p_curr[1]], dtype=np.float32))

                    ortho_arr = np.array(ortho_pts, dtype=np.float32)
                    u_poly = (ortho_arr[:, 0] - 2.0) * cell_px + u_min
                    v_poly = (ortho_arr[:, 1] - 2.0) * cell_px + v_min
                    uv_poly = np.stack([u_poly, v_poly], axis=1)
                    min_step_px = max(4.5, 2.8 / max(gsd_m, 0.15))
                    uv_clean = clean_rectilinear_vertices(uv_poly, min_step_px)

                    if 5 <= len(uv_clean) <= 12:
                        cos_b, sin_b = math.cos(-rad), math.sin(-rad)
                        x_poly = uv_clean[:, 0] * cos_b - uv_clean[:, 1] * sin_b + cx
                        y_poly = uv_clean[:, 0] * sin_b + uv_clean[:, 1] * cos_b + cy
                        poly_res = np.stack([x_poly, y_poly], axis=1)
                        s_poly = sg.Polygon(poly_res)
                        if not s_poly.is_valid:
                            s_poly = shapely.make_valid(s_poly)
                            if s_poly.geom_type == 'MultiPolygon':
                                s_poly = max(s_poly.geoms, key=lambda g: g.area)
                        if s_poly.is_valid and s_poly.geom_type == 'Polygon':
                            coords = np.array(list(s_poly.exterior.coords)[:-1], dtype=np.float32)
                            if 5 <= len(coords) <= 12 and s_poly.area >= 0.52 * area_px:
                                return coords, "Orthogonal L/T-Shape", rw, rh

    if fill_ratio < 0.50:
        return np.array([]), "Rejected", 0.0, 0.0

    pad_u = rw * 0.025
    pad_v = rh * 0.025
    u0, u1 = u_min + pad_u, u_max - pad_u
    v0, v1 = v_min + pad_v, v_max - pad_v
    corners_uv = np.array([
        [u0, v0],
        [u1, v0],
        [u1, v1],
        [u0, v1]
    ], dtype=np.float32)
    cos_b, sin_b = math.cos(-rad), math.sin(-rad)
    x_c = corners_uv[:, 0] * cos_b - corners_uv[:, 1] * sin_b + cx
    y_c = corners_uv[:, 0] * sin_b + corners_uv[:, 1] * cos_b + cy
    return np.stack([x_c, y_c], axis=1), "Rectangle / Box", rw, rh


if __name__ == "__main__":
    pipe = GeoDepthPipeline()
    bgr = cv2.imread(r"C:\Users\himar\OneDrive\Desktop\Project Final Image\India Image.png")
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]
    gsd_m = 0.45

    seg, hgt = pipe._infer_neural_heights(rgb)
    ui_mask = detect_map_ui_chrome(rgb)
    road_mask = detect_map_vector_roads(rgb)

    r, g, b = rgb[..., 0].astype(float), rgb[..., 1].astype(float), rgb[..., 2].astype(float)
    gray = 0.299 * r + 0.587 * g + 0.114 * b
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    exg = (2.0 * g - r - b) / (r + g + b + 1e-5)

    veg = (exg > 0.055) & (g > 35) & (H >= 22) & (H <= 98) & (S > 24)
    water = ((b - r) / (b + r + 1e-5) > 0.14) & (V < 130) & (~veg)
    blur_bg = cv2.GaussianBlur(gray, (35, 35), 9.0)

    # Distinct Roof Spectral Classes:
    blue_roof = (b > r + 7) & (b >= g - 3) & (b > 80) & (V > 85) & (~water) & (~veg)
    red_roof = (r > g + 16) & (r > b + 18) & (r > 85) & (S > 30) & (~veg)
    bright_concrete = (gray > 148) & (gray - blur_bg > 18) & (S < 35) & (~veg) & (~water)

    # Bridge internal room shadows inside strong building footprints (like walled structures under construction)
    seg_bld_bridged = cv2.morphologyEx((seg == 2).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))

    # Exclude exterior shadows, trees, water, roads, and low-elevation bare soil / farm plots
    dark_shadow = ((V < 46) | ((gray < blur_bg - 26) & (V < 80))) & (seg_bld_bridged == 0)
    bare_soil = (r > b + 18) & (S > 32) & (hgt < 3.2) & (~red_roof)

    is_bld = ((seg == 2) | (blue_roof & (hgt >= 0.8)) | (red_roof & (hgt >= 1.4)) | (bright_concrete & (hgt >= 1.5)))
    is_bld = is_bld & (~veg) & (~water) & (~dark_shadow) & (~bare_soil) & (road_mask == 0) & (ui_mask == 0)
    bld_mask = is_bld.astype(np.uint8)

    # Bilateral LAB color gradients
    bi_rgb = cv2.bilateralFilter(rgb, 7, 40, 40)
    lab = cv2.cvtColor(bi_rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    gx_l = cv2.Sobel(lab[..., 0], cv2.CV_32F, 1, 0, ksize=3)
    gy_l = cv2.Sobel(lab[..., 0], cv2.CV_32F, 0, 1, ksize=3)
    gx_a = cv2.Sobel(lab[..., 1], cv2.CV_32F, 1, 0, ksize=3)
    gy_a = cv2.Sobel(lab[..., 1], cv2.CV_32F, 0, 1, ksize=3)
    gx_b = cv2.Sobel(lab[..., 2], cv2.CV_32F, 1, 0, ksize=3)
    gy_b = cv2.Sobel(lab[..., 2], cv2.CV_32F, 0, 1, ksize=3)
    color_grad = np.sqrt(gx_l**2 + gy_l**2 + 2.2 * (gx_a**2 + gy_a**2 + gx_b**2 + gy_b**2))

    # Material boundary cut: separate blue metal roofs from non-blue roofs
    blue_clean = cv2.morphologyEx(blue_roof.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    blue_clean = cv2.morphologyEx(blue_clean, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    blue_grad = cv2.morphologyEx(blue_clean, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))

    roof_boundary_cut = (color_grad > 95.0) | (blue_grad > 0) | ((color_grad > 62.0) & (gray < blur_bg - 8))
    bld_separated = bld_mask.copy()
    bld_separated[roof_boundary_cut] = 0
    bld_separated = cv2.morphologyEx(bld_separated, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    num_b, b_labels, b_stats, _ = cv2.connectedComponentsWithStats(blue_clean & bld_mask)
    for bid in range(1, num_b):
        if b_stats[bid, cv2.CC_STAT_AREA] >= 60:
            bld_separated[b_labels == bid] = 1
            b_comp = (b_labels == bid).astype(np.uint8)
            moat = cv2.dilate(b_comp, np.ones((5, 5), np.uint8)) - b_comp
            bld_separated[moat > 0] = 0

    num_cc, cc_labels, cc_stats, _ = cv2.connectedComponentsWithStats(bld_separated)
    final_instances = []
    min_area_px = max(16, int(round(16.0 / (gsd_m ** 2))))

    for cid in range(1, num_cc):
        area = cc_stats[cid, cv2.CC_STAT_AREA]
        if area < min_area_px:
            continue
        x0 = cc_stats[cid, cv2.CC_STAT_LEFT]
        y0 = cc_stats[cid, cv2.CC_STAT_TOP]
        cw = cc_stats[cid, cv2.CC_STAT_WIDTH]
        ch = cc_stats[cid, cv2.CC_STAT_HEIGHT]
        comp_crop = (cc_labels[y0:y0+ch, x0:x0+cw] == cid).astype(np.uint8)
        area_m2 = area * (gsd_m ** 2)

        # Reject flat agricultural field / bare ground false positives
        h_vals = hgt[y0:y0+ch, x0:x0+cw][comp_crop > 0]
        g_vals = gray[y0:y0+ch, x0:x0+cw][comp_crop > 0]
        b_is_spec = np.mean(blue_roof[y0:y0+ch, x0:x0+cw][comp_crop > 0]) > 0.3 or np.mean(red_roof[y0:y0+ch, x0:x0+cw][comp_crop > 0]) > 0.3
        if np.median(h_vals) < 2.2 and not b_is_spec and np.std(g_vals) < 16.0:
            continue

        lab_crop = lab[y0:y0+ch, x0:x0+cw][comp_crop > 0]
        color_std = float(np.mean(np.std(lab_crop, axis=0))) if len(lab_crop) > 0 else 0.0
        bbox_fill = area / max(cw * ch, 1)

        if (area_m2 <= 145.0 and bbox_fill >= 0.48) or (color_std < 11.5 and bbox_fill >= 0.42):
            final_instances.append((x0, y0, comp_crop))
        else:
            dist_c = cv2.distanceTransform(comp_crop, cv2.DIST_L2, 5)
            peak_r = max(4, int(round(3.4 / gsd_m)))
            k_pk = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (peak_r * 2 + 1, peak_r * 2 + 1))
            pk = (dist_c == cv2.dilate(dist_c, k_pk)) & (dist_c >= max(2.2, 0.15 * dist_c.max())) & (comp_crop > 0)
            n_mk, mks = cv2.connectedComponents(pk.astype(np.uint8))
            if n_mk <= 2:
                final_instances.append((x0, y0, comp_crop))
            else:
                grad_crop = np.clip(color_grad[y0:y0+ch, x0:x0+cw], 0, 255).astype(np.uint8)
                grad_bgr = cv2.cvtColor(grad_crop, cv2.COLOR_GRAY2BGR)
                mks_ws = mks.copy()
                mks_ws[comp_crop == 0] = -1
                cv2.watershed(grad_bgr, mks_ws)
                for sub_id in range(1, n_mk):
                    sub_m = ((mks_ws == sub_id) & (comp_crop > 0)).astype(np.uint8)
                    if cv2.countNonZero(sub_m) >= min_area_px:
                        final_instances.append((x0, y0, sub_m))

    candidates = []
    min_w_px = max(3.4, 2.7 / gsd_m)
    for (x0, y0, m_crop) in final_instances:
        cnts, _ = cv2.findContours(m_crop, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not cnts:
            continue
        c = max(cnts, key=cv2.contourArea)
        c_area = cv2.contourArea(c)
        if c_area < min_area_px:
            continue
        c_full = c + np.array([[[x0, y0]]], dtype=np.int32)
        M = cv2.moments(c_full)
        if M["m00"] <= 0:
            continue
        cx = float(M["m10"] / M["m00"])
        cy = float(M["m01"] / M["m00"])

        gx_crop = gx_l[y0:y0+m_crop.shape[0], x0:x0+m_crop.shape[1]]
        gy_crop = gy_l[y0:y0+m_crop.shape[0], x0:x0+m_crop.shape[1]]
        ang = compute_dominant_roof_angle(c_full, gx_crop, gy_crop)
        poly_pts, shape_type, rw, rh = fit_orthogonal_polygon(m_crop, x0, y0, cx, cy, ang, gsd_m)
        if len(poly_pts) < 4 or min(rw, rh) < min_w_px or max(rw, rh) / max(min(rw, rh), 1.0) > 6.5:
            continue
        candidates.append({
            "poly": poly_pts,
            "shape_type": shape_type,
            "area_px": c_area,
            "cx": cx,
            "cy": cy
        })

    candidates.sort(key=lambda x: -x["area_px"])
    accepted = []
    accepted_polys = []
    for item in candidates:
        p = sg.Polygon(item["poly"])
        if not p.is_valid:
            p = shapely.make_valid(p)
            if p.geom_type == 'MultiPolygon':
                p = max(p.geoms, key=lambda g: g.area)
        if p.geom_type != 'Polygon' or p.area < min_area_px:
            continue
        overlap = False
        for acc_p in accepted_polys:
            if acc_p.intersects(p):
                inter = acc_p.intersection(p).area
                if inter / min(p.area, acc_p.area) > 0.25:
                    overlap = True
                    break
        if not overlap:
            accepted.append(item)
            accepted_polys.append(p)

    vis = bgr.copy()
    l_count = 0
    for b_item in accepted:
        pts = np.round(b_item["poly"]).astype(np.int32)
        col = (255, 190, 0) if b_item["shape_type"] != "Rectangle / Box" else (0, 130, 255)
        if b_item["shape_type"] != "Rectangle / Box":
            l_count += 1
        cv2.polylines(vis, [pts], True, col, 2)
    cv2.imwrite("debug_india_improved_2d.png", vis)
    print(f"Total buildings: {len(accepted)} (Complex L/T-Shapes: {l_count})")
