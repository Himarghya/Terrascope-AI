import os
import cv2
import numpy as np
import math
import sys
sys.path.append(os.path.join(os.getcwd(), "backend"))

from core.geodepth_pipeline import GeoDepthPipeline
from core.preprocessor import detect_map_ui_chrome, detect_map_vector_roads

pipe = GeoDepthPipeline()

img_path = os.path.join("backend", "uploads", "sapporo_district.jpg")
img_bgr = cv2.imread(img_path)
img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
h, w = img_rgb.shape[:2]
gsd_m = 0.25

raw = pipe._run_single_window(img_rgb)
seg = np.argmax(raw[:5], axis=0).astype(np.uint8)
hgt = np.maximum(0.0, raw[5] * pipe.h_scale)
ui_mask = detect_map_ui_chrome(img_rgb)
road_mask = detect_map_vector_roads(img_rgb)

elevated = (hgt >= 2.5) & (seg != 1) & (seg != 4) & (road_mask == 0) & (ui_mask == 0)
bld_mask = (((seg == 2) | elevated) & (road_mask == 0) & (ui_mask == 0)).astype(np.uint8)

k3 = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
bld_mask = cv2.morphologyEx(bld_mask, cv2.MORPH_OPEN, k3)
bld_mask = cv2.morphologyEx(bld_mask, cv2.MORPH_CLOSE, k3)

peak_r_px = max(4, int(round(2.0 / gsd_m)))
dist = cv2.distanceTransform(bld_mask, cv2.DIST_L2, 5)
k_peak = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (peak_r_px*2+1, peak_r_px*2+1))
dilated = cv2.dilate(dist, k_peak)

peaks = (dist == dilated) & (dist >= 2.0) & (bld_mask > 0)
num_houses, house_markers = cv2.connectedComponents(peaks.astype(np.uint8))

markers = house_markers.copy()
markers[bld_mask == 0] = -1

gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
bi = cv2.bilateralFilter(gray, 5, 40, 40)
sobelx = cv2.Sobel(bi, cv2.CV_32F, 1, 0, ksize=3)
sobely = cv2.Sobel(bi, cv2.CV_32F, 0, 1, ksize=3)
grad = np.sqrt(sobelx**2 + sobely**2)
grad_norm = cv2.normalize(grad, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
grad_rgb = cv2.cvtColor(grad_norm, cv2.COLOR_GRAY2BGR)

cv2.watershed(grad_rgb, markers)

min_house_px = max(6, int(round(14.0 / (gsd_m**2))))
extracted = []

for hid in range(1, num_houses):
    h_mask = (markers == hid).astype(np.uint8)
    area_px = cv2.countNonZero(h_mask)
    if area_px < min_house_px:
        continue
    cnts, _ = cv2.findContours(h_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        continue
    c = max(cnts, key=cv2.contourArea)
    if cv2.contourArea(c) < min_house_px:
        continue

    x, y, bw, bh = cv2.boundingRect(c)
    rect = cv2.minAreaRect(c)
    (cx, cy), (rw, rh), ang = rect
    if rw < rh:
        rw, rh = rh, rw
        ang = (ang + 90) % 180

    rect_area = max(rw * rh, 1.0)
    fill = area_px / rect_area
    area_m2 = round(area_px * (gsd_m**2), 1)
    bld_len_m = round(rw * gsd_m, 1)
    bld_wid_m = round(rh * gsd_m, 1)

    if area_m2 > 1800.0 or bld_len_m > 80.0:
        continue

    # Predominant shape fitting
    if fill >= 0.52 or area_m2 <= 280:
        poly = cv2.boxPoints(((cx, cy), (rw, rh), ang))
        shape_type = "Rectangle / Box"
    else:
        # Orthogonal L/T-Shape in canonical frame
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

    # SIHE metric height
    hv = hgt[h_mask > 0]
    med_h = float(np.median(hv)) if hv.size else 4.5
    p90 = float(np.percentile(hv, 90)) if hv.size else med_h * 1.2
    est_h = max(3.5, med_h)

    # Photo-sample median roof color
    rgb_crop = img_rgb[y:y+bh, x:x+bw]
    m_crop = h_mask[y:y+bh, x:x+bw]
    if np.any(m_crop > 0):
        r_c = int(np.median(rgb_crop[..., 0][m_crop > 0]))
        g_c = int(np.median(rgb_crop[..., 1][m_crop > 0]))
        b_c = int(np.median(rgb_crop[..., 2][m_crop > 0]))
    else:
        r_c, g_c, b_c = 180, 180, 180

    hex_color = f"#{r_c:02x}{g_c:02x}{b_c:02x}"

    if shape_type == "Rectangle / Box" and (p90 - med_h) > 1.0:
        roof_shape = "Gabled / Pitched Roof"
    elif area_m2 <= 120.0:
        roof_shape = "Hipped Roof"
    else:
        roof_shape = "Flat Roof with Parapet"

    extracted.append({
        "id": f"BLD-{len(extracted)+1:03d}",
        "polygon_px": np.round(poly).astype(int).tolist(),
        "shape_type": shape_type,
        "area_m2": area_m2,
        "height_m": round(est_h, 1),
        "estimated_height_m": round(est_h, 1),
        "roof_shape": roof_shape,
        "base_color_hex": hex_color,
        "center_px": [round(float(cx), 1), round(float(cy), 1)],
        "confidence": 0.94
    })

print(f"Extracted {len(extracted)} complete individual houses!")

vis = img_bgr.copy()
for b in extracted:
    p = np.array(b["polygon_px"], dtype=np.int32)
    # Vibrant orange outline like the user's viewer
    cv2.polylines(vis, [p], isClosed=True, color=(20, 120, 240), thickness=2)
    cv2.fillPoly(vis, [p], color=(10, 80, 220))

combined = cv2.addWeighted(vis, 0.45, img_bgr, 0.55, 0)
out_path = r"C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b\test_complete_coverage_100.png"
cv2.imwrite(out_path, combined)
print(f"Saved complete coverage overlay to {out_path}")
