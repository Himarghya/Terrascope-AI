import os
import cv2
import numpy as np
import math
import sys
sys.path.append(os.path.join(os.getcwd(), "backend"))

from core.geodepth_pipeline import GeoDepthPipeline
from test_holistic_buildings import extract_holistic_buildings

pipe = GeoDepthPipeline()

test_images = [
    "f84d9a79-dc6f-4fd6-8bb3-0e882cfc21fa_Japan Image.png",
    "f600d927-b424-4e7a-a9d4-8c1c9097d0e7_India Image.png",
    "e2e730e7-6f0a-4437-a3ac-9499f2281d3e_China Image.jpeg",
    "geodepth_66d6c128_nakul.png",
    "geodepth_8990957a_sangam.png"
]

uploads_dir = os.path.join("backend", "uploads")

for img_name in test_images:
    p = os.path.join(uploads_dir, img_name)
    if not os.path.exists(p):
        continue
    img_bgr = cv2.imread(p)
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    print(f"\n--- Testing: {img_name} ({img_rgb.shape[1]}x{img_rgb.shape[0]}) ---")

    seg, hgt, tuned_gsd = pipe.infer_adaptive_multiscale(img_rgb, initial_gsd_m=0.35)
    auto_gsd, gsd_src, _ = pipe.estimate_auto_gsd(img_rgb, seg, default_gsd=tuned_gsd)
    print(f"  Auto-GSD: {auto_gsd:.2f} m/px ({gsd_src})")

    blds = extract_holistic_buildings(seg, hgt, img_rgb, gsd_m=auto_gsd)
    print(f"  Extracted buildings: {len(blds)}")

    # Check for duplicates / fragments (<15px apart)
    centers = np.array([b["center_px"] for b in blds])
    close = 0
    for i in range(len(blds)):
        for j in range(i + 1, len(blds)):
            if np.linalg.norm(centers[i] - centers[j]) < 15.0:
                close += 1
    rect_c = sum(1 for b in blds if b["shape_type"] == "Rectangle / Box")
    l_c = sum(1 for b in blds if b["shape_type"] == "Orthogonal L/T-Shape")
    print(f"  Close pairs (<15px): {close} | Rectangles: {rect_c} | L/T-Shapes: {l_c}")
