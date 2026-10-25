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

seg, hgt, gsd = pipe.infer_adaptive_multiscale(img_rgb, initial_gsd_m=0.25)
print(f"seg shape: {seg.shape}, hgt shape: {hgt.shape}")

buildings = pipe.extract_buildings(seg, hgt, img_rgb, gsd_m=0.25)
print(f"Extracted {len(buildings)} buildings at gsd=0.25")

# Draw the polygons onto the image
overlay = img_bgr.copy()
for b in buildings:
    poly = np.array(b["polygon_px"], dtype=np.int32)
    cv2.polylines(overlay, [poly], isClosed=True, color=(0, 140, 255), thickness=2)
    # Fill with semi-transparent
    cv2.fillPoly(overlay, [poly], color=(0, 100, 200))

alpha = 0.5
combined = cv2.addWeighted(overlay, alpha, img_bgr, 1 - alpha, 0)
out_path = r"C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b\test_overlay_sapporo.png"
cv2.imwrite(out_path, combined)
print(f"Saved overlay to {out_path}")
