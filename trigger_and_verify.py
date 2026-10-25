import requests, time, json, os

BASE_URL = "http://127.0.0.1:8000"

def process_upload(upload_id):
    print(f"Triggering /api/process for upload_id={upload_id}...")
    res = requests.post(f"{BASE_URL}/api/process", data={"upload_id": upload_id})
    if res.status_code != 200:
        print("Error submitting process:", res.status_code, res.text)
        return None, None
    data = res.json()
    job_id = data["job_id"]
    print(f"Job started: {job_id}")

    # Poll until completed
    for _ in range(60):
        time.sleep(2)
        jres = requests.get(f"{BASE_URL}/api/job/{job_id}")
        jdata = jres.json()
        status = jdata.get("status")
        progress = jdata.get("progress", 0)
        step = jdata.get("step", "")
        print(f"[{job_id}] {status} ({progress}%): {step}")
        if status in ["completed", "COMPLETED"]:
            break
        elif status in ["failed", "FAILED"]:
            print("Job failed:", jdata.get("error"))
            return job_id, None

    # Fetch scene
    sres = requests.get(f"{BASE_URL}/api/scene/{job_id}")
    sdata = sres.json()
    blds = sdata.get("buildings", [])
    print(f"[{job_id}] SUCCESS! Scene generated with {len(blds)} buildings!")
    return job_id, sdata

# Process Japanese Village upload
job_id_jp, scene_jp = process_upload("e7008266-1bb9-45ec-87a2-048a7e3e86e2")
# Process China Village upload
job_id_cn, scene_cn = process_upload("f608be20-00b7-49d7-8777-e46174344b19")

print(f"Japanese Village: Job {job_id_jp}, {len(scene_jp['buildings'])} buildings")
print(f"China Village: Job {job_id_cn}, {len(scene_cn['buildings'])} buildings")
