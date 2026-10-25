import os
import cv2
import numpy as np
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

peak_r_px = max(4, int(round(2.0 / gsd_m))) # 2.0m spacing
dist = cv2.distanceTransform(bld_mask, cv2.DIST_L2, 5)
k_peak = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (peak_r_px*2+1, peak_r_px*2+1))
dilated = cv2.dilate(dist, k_peak)

peaks = (dist == dilated) & (dist >= 2.0) & (bld_mask > 0)
num_houses, house_markers = cv2.connectedComponents(peaks.astype(np.uint8))
print(f"Total peaks with peak_r_px={peak_r_px}: {num_houses - 1}")

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

min_house_px = max(6, int(round(12.0 / (gsd_m**2))))
print(f"min_house_px: {min_house_px}")

valid_count = 0
filtered_reasons = {}
for hid in range(1, num_houses):
    h_mask = (markers == hid).astype(np.uint8)
    area_px = cv2.countNonZero(h_mask)
    if area_px < min_house_px:
        filtered_reasons["too_small"] = filtered_reasons.get("too_small", 0) + 1
        continue
    cnts, _ = cv2.findContours(h_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        filtered_reasons["no_cnt"] = filtered_reasons.get("no_cnt", 0) + 1
        continue
    c = max(cnts, key=cv2.contourArea)
    if cv2.contourArea(c) < min_house_px:
        filtered_reasons["cnt_too_small"] = filtered_reasons.get("cnt_too_small", 0) + 1
        continue
    area_m2 = cv2.contourArea(c) * (gsd_m**2)
    if area_m2 > 1800.0:
        filtered_reasons["too_large"] = filtered_reasons.get("too_large", 0) + 1
        continue
    valid_count += 1

print(f"Valid houses: {valid_count}, filtered reasons: {filtered_reasons}")
