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

# 1. Native neural output
raw = pipe._run_single_window(img_rgb)
seg_native = np.argmax(raw[:5], axis=0).astype(np.uint8)
hgt_native = np.maximum(0.0, raw[5] * pipe.h_scale)

# 2. What did infer_adaptive_multiscale do?
seg_adapt, hgt_adapt, tuned_gsd = pipe.infer_adaptive_multiscale(img_rgb, initial_gsd_m=0.25)

# Save images to brain directory to inspect
out_dir = r"C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b"

# Color map for classes: 0: ground(black), 1: tree(green), 2: building(white), 3: road(gray), 4: water(blue)
cmap = {
    0: (0, 0, 0),
    1: (0, 255, 0),
    2: (255, 255, 255),
    3: (128, 128, 128),
    4: (255, 0, 0)
}

vis_native = np.zeros_like(img_bgr)
for c, col in cmap.items():
    vis_native[seg_native == c] = col

vis_adapt = np.zeros_like(img_bgr)
for c, col in cmap.items():
    vis_adapt[seg_adapt == c] = col

cv2.imwrite(os.path.join(out_dir, "debug_seg_native.png"), vis_native)
cv2.imwrite(os.path.join(out_dir, "debug_seg_adapt.png"), vis_adapt)
cv2.imwrite(os.path.join(out_dir, "debug_hgt_native.png"), cv2.applyColorMap((np.clip(hgt_native/15.0, 0, 1)*255).astype(np.uint8), cv2.COLORMAP_TURBO))
cv2.imwrite(os.path.join(out_dir, "debug_hgt_adapt.png"), cv2.applyColorMap((np.clip(hgt_adapt/15.0, 0, 1)*255).astype(np.uint8), cv2.COLORMAP_TURBO))

print(f"Native building pixels: {np.sum(seg_native == 2)}")
print(f"Adaptive building pixels: {np.sum(seg_adapt == 2)}")
print(f"Tuned GSD: {tuned_gsd}")
