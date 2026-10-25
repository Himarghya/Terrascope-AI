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

# Let's run raw trained model inference
print(f"Image shape: {h}x{w}")
raw = pipe._run_single_window(img_rgb)
print(f"Raw output shape: {raw.shape}") # (6, H, W)
seg_raw = np.argmax(raw[:5], axis=0).astype(np.uint8)
hgt_raw = np.maximum(0.0, raw[5] * pipe.h_scale)

print(f"Raw trained model class distribution:")
for cid in range(5):
    pct = np.mean(seg_raw == cid) * 100
    print(f"  Class {cid}: {pct:.1f}%")

# Save visualizations
cv2.imwrite("test_seg_raw.png", (seg_raw * 50).astype(np.uint8))
cv2.imwrite("test_hgt_raw.png", np.clip(hgt_raw / 20.0 * 255, 0, 255).astype(np.uint8))

print(f"Max height raw: {np.max(hgt_raw):.1f}m, mean height: {np.mean(hgt_raw):.1f}m")
print(f"Height > 3.0m percentage: {np.mean(hgt_raw > 3.0)*100:.1f}%")
print(f"Height > 2.0m percentage: {np.mean(hgt_raw > 2.0)*100:.1f}%")
