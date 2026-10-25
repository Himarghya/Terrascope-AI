import urllib.request
import urllib.parse
import json
import time

def test_full_reconstruction():
    data = urllib.parse.urlencode({
        'sample_id': 'suburban_residential',
        'gsd_m': '0.4',
        'solar_azimuth': '135.0',
        'solar_elevation': '45.0'
    }).encode('utf-8')

    req = urllib.request.Request('http://127.0.0.1:8000/api/process', data=data, method='POST')
    res = json.loads(urllib.request.urlopen(req).read().decode())
    job_id = res['job_id']
    print(f"Job started with ID: {job_id}")

    for _ in range(40):
        status_res = json.loads(urllib.request.urlopen(f'http://127.0.0.1:8000/api/job/{job_id}').read().decode())
        prog = status_res.get('progress')
        step = status_res.get('step')
        status = status_res.get('status')
        print(f"[{status}] {prog}% - {step}")
        if status in ['COMPLETED', 'FAILED']:
            break
        time.sleep(1)

    if status == 'COMPLETED':
        scene_res = json.loads(urllib.request.urlopen(f'http://127.0.0.1:8000/api/scene/{job_id}').read().decode())
        print("\n--- RECONSTRUCTION PIPELINE COMPLETED ---")
        print("Summary stats:", json.dumps(scene_res['summary_stats'], indent=2))
        print(f"Total buildings detected: {len(scene_res['buildings'])}")
        print(f"Total trees detected: {len(scene_res['trees'])}")
        print(f"GLB model URL: {scene_res['glb_url']}")
        print(f"GeoJSON URL: {scene_res['geojson_url']}")
        b0 = scene_res['buildings'][0]
        print(f"Building 0: ID={b0['id']}, Area={b0['footprint_area_m2']}m2, Height={b0['estimated_height_m']}m, Roof={b0['roof_shape']}")
        t0 = scene_res['trees'][0]
        print(f"Tree 0: ID={t0['id']}, Diam={t0['crown_diameter_m']}m, Height={t0['estimated_canopy_height_m']}m, Class={t0['vegetation_category']}")
    else:
        print("Pipeline failed:", status_res)

if __name__ == '__main__':
    test_full_reconstruction()
