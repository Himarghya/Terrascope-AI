import requests
import time
import os
import json

img_path = r"C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b\.user_uploaded\media_1792407435749_ac9ef9d1.jpg"
print(f"Uploading {os.path.basename(img_path)} to Live GeoDepth 3D Platform...")

with open(img_path, "rb") as f:
    resp = requests.post(
        "http://127.0.0.1:8000/api/process",
        files={"file": ("user_settlement_aerial.jpg", f, "image/jpeg")}
    )

if resp.status_code != 200:
    print(f"Failed to submit: {resp.status_code} - {resp.text}")
    exit(1)

job_data = resp.json()
job_id = job_data["job_id"]
print(f"Reconstruction job submitted! Job ID: {job_id}")

while True:
    time.sleep(2)
    job_status = requests.get(f"http://127.0.0.1:8000/api/jobs/{job_id}").json()
    prog = job_status.get("progress", 0)
    step = job_status.get("step", "")
    st = job_status.get("status", "")
    print(f"[{st}] Progress: {prog}% - {step}")
    if st in ["COMPLETED", "FAILED"]:
        break

if st == "COMPLETED":
    scene = requests.get(f"http://127.0.0.1:8000/api/scenes/{job_id}").json()
    print("\n" + "=" * 60)
    print("LIVE 3D RECONSTRUCTION COMPLETE")
    print("=" * 60)
    print(f"Auto-Calculated GSD: {scene.get('gsd_m')} meters/pixel")
    print(f"Scale Source: {scene.get('gsd_source')}")
    blds = scene.get("buildings", [])
    blds_3d = scene.get("buildings_3d", [])
    trees = scene.get("trees", [])
    print(f"Total Individual Buildings Extracted: {len(blds)}")
    print(f"Total 3D Building Meshes Rendered: {len(blds_3d)}")
    print(f"Total Trees Detected: {len(trees)}")

    areas = [b["area_m2"] for b in blds]
    if areas:
        print(f"Building Footprint Areas (m2): Min={min(areas):.1f}, Median={sorted(areas)[len(areas)//2]:.1f}, Max={max(areas):.1f}")
        small_houses = sum(1 for a in areas if a <= 200)
        print(f"Residential Houses (<=200 m2): {small_houses} / {len(areas)} ({small_houses / len(areas) * 100:.1f}%)")
        print(f"Largest 5 Buildings: {sorted(areas, reverse=True)[:5]}")

    with open("processed_user_scene.json", "w") as out_f:
        json.dump({
            "job_id": job_id,
            "gsd_m": scene.get("gsd_m"),
            "gsd_source": scene.get("gsd_source"),
            "building_count": len(blds),
            "blds_3d_count": len(blds_3d),
            "tree_count": len(trees),
            "sample_buildings": blds[:5]
        }, out_f, indent=2)
    print(f"\nSaved scene summary to processed_user_scene.json")
else:
    print(f"Pipeline job failed: {job_status}")
