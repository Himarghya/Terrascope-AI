import requests
import time

res = requests.post("http://127.0.0.1:8000/api/process", data={"sample_id": "sapporo_district"})
job_id = res.json()["job_id"]
print(f"Submitted sapporo_district job: {job_id}")

for _ in range(60):
    time.sleep(1)
    status = requests.get(f"http://127.0.0.1:8000/api/job/{job_id}").json()
    print(f"  {status['status']} ({status['progress']}%): {status['step']}")
    if status["status"] in ("COMPLETED", "FAILED"):
        break

scene = requests.get(f"http://127.0.0.1:8000/api/scene/{job_id}").json()
blds = scene["buildings"]
print(f"\n--- SUCCESS ---")
print(f"Total Buildings Extracted: {len(blds)}")
print(f"Buildings with Height >= 3.5m: {sum(1 for b in blds if b['estimated_height_m'] >= 3.5)}")
print(f"Sample buildings:")
for b in blds[:8]:
    print(f"  {b['id']}: {b.get('shape_type')} | {b['estimated_height_m']}m | {b['area_m2']}m2 | Roof: {b['roof_shape']}")
