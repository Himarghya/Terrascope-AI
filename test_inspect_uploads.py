import os
import cv2
import numpy as np
import matplotlib.pyplot as plt

# Let's inspect the uploaded images
uploads_dir = r"C:\Users\himar\.gemini\antigravity\scratch\satellite-3d-studio\backend\uploads"
files = [
    "e2e730e7-6f0a-4437-a3ac-9499f2281d3e_China Image.jpeg",
    "f600d927-b424-4e7a-a9d4-8c1c9097d0e7_India Image.png",
    "f84d9a79-dc6f-4fd6-8bb3-0e882cfc21fa_Japan Image.png",
    "geodepth_66d6c128_nakul.png",
    "geodepth_8990957a_sangam.png",
    "sapporo_district.jpg"
]

print("Checking available test images:")
for f in files:
    p = os.path.join(uploads_dir, f)
    if os.path.exists(p):
        img = cv2.imread(p)
        print(f"  {f}: shape={img.shape}")
    else:
        print(f"  {f}: NOT FOUND")
