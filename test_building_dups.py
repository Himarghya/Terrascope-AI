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
auto_gsd, gsd_source, _ = pipe.estimate_auto_gsd(img_rgb, seg, default_gsd=gsd)
print(f"Auto GSD: {auto_gsd} ({gsd_source})")

buildings = pipe.extract_buildings(seg, hgt, img_rgb, gsd_m=auto_gsd)
print(f"Total extracted buildings: {len(buildings)}")

# Check distance between building centers to see if multiple buildings are on the same house
centers = np.array([b["center_px"] for b in buildings])
close_pairs = 0
for i in range(len(buildings)):
    for j in range(i + 1, len(buildings)):
        dist = np.linalg.norm(centers[i] - centers[j])
        if dist < 15.0:  # less than 15 pixels apart!
            close_pairs += 1
            if close_pairs <= 5:
                print(f"  Close pair: {buildings[i]['id']} and {buildings[j]['id']} (dist={dist:.1f}px, area_i={buildings[i]['area_m2']}m2, area_j={buildings[j]['area_m2']}m2)")

print(f"Total pairs closer than 15px: {close_pairs}")
