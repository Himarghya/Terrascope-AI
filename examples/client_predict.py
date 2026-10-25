"""
Example Python Client for GeoDepth 3D Model Inference API.
Demonstrates sending a 2D overhead image to POST /v1/predict and retrieving
the predicted 16-bit heightmap artifact.
"""

import sys
import requests

API_BASE_URL = "http://localhost:8000/v1"
API_KEY = ""  # Optional: set if GEODEPTH_API_KEY is configured on the server


def predict_image(image_path: str, calibrate: bool = False, gsd_m: float = 0.4):
    print(f"Sending image '{image_path}' to GeoDepth 3D Inference API...")
    
    headers = {}
    if API_KEY:
        headers["X-API-Key"] = API_KEY

    with open(image_path, "rb") as f:
        files = {"image": (image_path, f, "image/png")}
        params = {"calibrate": str(calibrate).lower(), "gsd_m": gsd_m}
        response = requests.post(f"{API_BASE_URL}/predict", files=files, params=params, headers=headers)

    if response.status_code != 200:
        print(f"Error {response.status_code}: {response.text}")
        return None

    data = response.json()
    print("Inference successful!")
    print(f"  Prediction ID:     {data['prediction_id']}")
    print(f"  Model Version:     {data['model_version']} on {data['device']}")
    print(f"  Inference Latency: {data['inference_time_ms']} ms")
    print(f"  Dimensions:        {data['input']['width']} x {data['input']['height']}")
    print(f"  Height Units:      {data['prediction']['height_units']}")
    print(f"  Min / Max Value:   {data['prediction']['statistics']['min']} / {data['prediction']['statistics']['max']}")
    print(f"  Download URL:      {data['prediction']['output_url']}")

    # Download output artifact
    output_url = f"http://localhost:8000{data['prediction']['output_url']}?format=png"
    out_file = f"output_{data['prediction_id']}.png"
    print(f"Downloading 16-bit heightmap to {out_file}...")
    res_artifact = requests.get(output_url, headers=headers)
    if res_artifact.status_code == 200:
        with open(out_file, "wb") as f_out:
            f_out.write(res_artifact.content)
        print(f"Saved {out_file} successfully!")
    return data


if __name__ == "__main__":
    if len(sys.argv) > 1:
        img_path = sys.argv[1]
    else:
        print("Usage: python client_predict.py <path_to_image>")
        print("Example: python client_predict.py sample_overhead.png")
        sys.exit(0)

    predict_image(img_path)
