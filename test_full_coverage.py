import os
import cv2
import numpy as np
import sys
sys.path.append(os.path.join(os.getcwd(), "backend"))

from core.geodepth_pipeline import GeoDepthPipeline

pipe = GeoDepthPipeline()

img_path = os.path.join("backend", "uploads", "sapporo_district.jpg")
img_bgr = cv2.imread(img_path)
img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
h, w = img_rgb.shape[:2]
gsd_m = 0.25

# 1. Run trained model at native resolution
raw = pipe._run_single_window(img_rgb)
seg = np.argmax(raw[:5], axis=0).astype(np.uint8)
hgt = np.maximum(0.0, raw[5] * pipe.h_scale)

# Building mask from model: class 2 or high relative height
bld_mask = ((seg == 2) | ((hgt > 3.2) & (seg != 1) & (seg != 3))).astype(np.uint8)

# Clean small noise
k3 = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
bld_mask = cv2.morphologyEx(bld_mask, cv2.MORPH_OPEN, k3)

print(f"Total building mask pixels: {np.sum(bld_mask)} ({np.mean(bld_mask)*100:.1f}%)")

# Let's test watershed house instance separation
dist = cv2.distanceTransform(bld_mask, cv2.DIST_L2, 5)

# Peak finding for individual house centers:
# A typical house has width ~8m -> ~32px at 0.25m/px, radius ~16px
# Peaks can be detected using maximum filter / dilate
peak_radius = 9  # minimum distance between house centers (approx 4.5m)
k_peak = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (peak_radius*2+1, peak_radius*2+1))
dilated = cv2.dilate(dist, k_peak)

# Peaks must be equal to local maximum and have minimum distance transform value
peaks = (dist == dilated) & (dist >= 3.0) & (bld_mask > 0)
num_houses, house_markers = cv2.connectedComponents(peaks.astype(np.uint8))
print(f"Detected individual house peaks/markers: {num_houses - 1}")

# Run marker-controlled watershed to delineate each house boundary
markers = house_markers.copy()
markers[bld_mask == 0] = -1
# Gradient magnitude for watershed boundaries
gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
sobelx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
sobely = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
grad = np.sqrt(sobelx**2 + sobely**2)
grad_norm = cv2.normalize(grad, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
grad_rgb = cv2.cvtColor(grad_norm, cv2.COLOR_GRAY2BGR)

cv2.watershed(img_bgr, markers)

# Extract polygon for each individual house
house_polygons = []
min_house_px = int(25.0 / (gsd_m**2)) # at least 25 m2

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

    # Fit predominant shape
    rect = cv2.minAreaRect(c)
    (cx, cy), (rw, rh), ang = rect
    if rw < rh:
        rw, rh = rh, rw
        ang = (ang + 90) % 180
    fill = area_px / max(rw * rh, 1.0)
    area_m2 = area_px * (gsd_m**2)

    if fill >= 0.55 or area_m2 <= 300:
        poly = cv2.boxPoints(((cx, cy), (rw, rh), ang))
    else:
        poly = cv2.approxPolyDP(c, max(1.5, 0.02 * cv2.arcLength(c, True)), True).reshape(-1, 2)

    house_polygons.append({
        "id": f"BLD-{hid:03d}",
        "poly": poly,
        "area_m2": area_m2,
        "h": float(np.median(hgt[h_mask > 0])) if np.any(h_mask > 0) else 5.0
    })

print(f"Total separated individual house polygons: {len(house_polygons)}")

# Draw overlay
vis = img_bgr.copy()
for hp in house_polygons:
    p = np.array(hp["poly"], dtype=np.int32)
    cv2.polylines(vis, [p], isClosed=True, color=(0, 140, 255), thickness=2)
    cv2.fillPoly(vis, [p], color=(0, 80, 200))

combined = cv2.addWeighted(vis, 0.45, img_bgr, 0.55, 0)
out_path = r"C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b\test_all_houses_covered.png"
cv2.imwrite(out_path, combined)
print(f"Saved full coverage test overlay to {out_path}")
