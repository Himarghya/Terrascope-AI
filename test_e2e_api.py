import urllib.request
import urllib.parse
import json
import time

def test_standalone():
    data = urllib.parse.urlencode({'sample_id': 'suburban_residential'}).encode()
    req = urllib.request.Request('http://127.0.0.1:8000/api/height-estimation/jobs', data=data)
    res = json.loads(urllib.request.urlopen(req).read().decode())
    job_id = res['job_id']
    print(f"Submitted Standalone SIHE Job ID: {job_id}")

    for i in range(25):
        time.sleep(1)
        st = json.loads(urllib.request.urlopen(f'http://127.0.0.1:8000/api/height-estimation/jobs/{job_id}').read().decode())
        print(f"[{i+1}s] {st['progress']}% - {st['step']} ({st['status']})")
        if st['status'] in ('COMPLETED', 'FAILED'):
            if st['status'] == 'COMPLETED':
                res_data = json.loads(urllib.request.urlopen(f'http://127.0.0.1:8000/api/height-estimation/jobs/{job_id}/result').read().decode())
                print(f"Standalone SIHE Result: unit={res_data['calibration']['height_unit']}, max_height={res_data['calibration']['max_object_height_m']}m, vis_url={res_data['visualization_url']}")
                feat_data = json.loads(urllib.request.urlopen(f'http://127.0.0.1:8000/api/height-estimation/jobs/{job_id}/features').read().decode())
                print(f"Standalone SIHE Features: {len(feat_data['buildings'])} buildings, {len(feat_data['trees'])} trees")
            else:
                print(f"FAILED: {st.get('error')}")
            break

if __name__ == '__main__':
    test_standalone()
