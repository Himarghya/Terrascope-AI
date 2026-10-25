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

seg, hgt, gsd = pipe.infer_adaptive_multiscale(img_rgb, initial_gsd_m=0.25)
print(f"seg shape: {seg.shape}, hgt shape: {hgt.shape}, best_gsd: {gsd}")
print(f"seg building pixels (== 2): {np.sum(seg == 2)} ({np.mean(seg == 2)*100:.1f}%)")

# Compare with raw inference at 1.0 scale (native resolution)
raw = pipe._run_single_window(img_rgb)
seg_native = np.argmax(raw[:5], axis=0).astype(np.uint8)
hgt_native = np.maximum(0.0, raw[5] * pipe.h_scale)
print(f"Native model building pixels (== 2): {np.sum(seg_native == 2)} ({np.mean(seg_native == 2)*100:.1f}%)")
print(f"Native model height > 3.0m: {np.sum(hgt_native > 3.0)} ({np.mean(hgt_native > 3.0)*100:.1f}%)")
print(f"Native model height > 2.0m: {np.sum(hgt_native > 2.0)} ({np.mean(hgt_native > 2.0)*100:.1f}%)")
