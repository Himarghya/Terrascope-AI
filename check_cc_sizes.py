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

raw = pipe._run_single_window(img_rgb)
seg = np.argmax(raw[:5], axis=0).astype(np.uint8)
hgt = np.maximum(0.0, raw[5] * pipe.h_scale)
gsd_m = 0.25

m = (seg == 2).astype(np.uint8)
num_cc, cc_labels, cc_stats, _ = cv2.connectedComponentsWithStats(m)
print(f"Number of raw building components: {num_cc}")
for i in range(1, num_cc):
    area_px = cc_stats[i, cv2.CC_STAT_AREA]
    area_m2 = area_px * (gsd_m ** 2)
    bw = cc_stats[i, cv2.CC_STAT_WIDTH]
    bh = cc_stats[i, cv2.CC_STAT_HEIGHT]
    print(f"  CC {i}: area_px={area_px}, area_m2={area_m2:.1f}m2, bbox=({bw}x{bh}px)")
