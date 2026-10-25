import os
import requests
import time

url = "http://127.0.0.1:8000/api/process"
img_path = r"backend\uploads\f600d927-b424-4e7a-a9d4-8c1c9097d0e7_India Image.png"

print(f"Uploading {img_path} with NO GSD specified (Testing pure Auto-GSD)...")
with open(img_path, "rb") as f:
    res = requests.post(url, files={"file": ("test_upload_india.png", f, "image/png")})

print("Response:", res.json())
job_id = res.json()["job_id"]

for _ in range(60):
    time.sleep(1)
    status_res = requests.get(f"http://127.0.0.1:8000/api/job/{job_id}").json()
    print(f"  {status_res['status']} ({status_res['progress']}%): {status_res['step']}")
    if status_res["status"] in ("COMPLETED", "FAILED"):
        break

scene_res = requests.get(f"http://127.0.0.1:8000/api/scene/{job_id}").json()
print("\n--- RESULTS ---")
print(f"GSD: {scene_res['gsd_m']} m/px ({scene_res['gsd_source']})")
blds = scene_res["buildings"]
print(f"Total Buildings Extracted: {len(blds)}")
shapes = {}
for b in blds:
    st = b.get("shape_type", "Unknown")
    shapes[st] = shapes.get(st, 0) + 1
print(f"Predominant Shapes: {shapes}")
print("Top 5 Buildings:")
for b in blds[:5]:
    print(f"  {b['id']}: {b.get('shape_type')} | {b['estimated_height_m']}m | {b['area_m2']}m2 | Roof: {b['roof_shape']} | Poly vertices: {len(b['polygon_px'])}")
