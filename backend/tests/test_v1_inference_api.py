"""
End-to-End Tests for GeoDepth 3D Model Inference API (v1).
Verifies:
1. Health endpoint GET /v1/health.
2. Prediction endpoint POST /v1/predict with real image data.
3. Metric calibration flag & parameter validation.
4. Output retrieval GET /v1/predictions/{id}/output across png, tif, npy, json formats.
5. Error handling for bad files, empty uploads, and missing predictions.
"""

import os
import sys
import io
import pytest
import numpy as np
import cv2
from fastapi.testclient import TestClient

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app

client = TestClient(app)


@pytest.fixture
def sample_overhead_image_bytes():
    """Generates an in-memory synthetic 256x256 RGB overhead image of buildings and terrain."""
    img = np.zeros((256, 256, 3), dtype=np.uint8)
    # Background terrain (olive green)
    img[:] = [80, 110, 60]
    # Building 1 (bright concrete roof)
    img[40:120, 50:150] = [210, 205, 195]
    # Building 2 (terracotta tile roof)
    img[140:220, 120:200] = [180, 90, 70]
    # Asphalt road
    img[120:140, :] = [50, 50, 50]

    success, encoded = cv2.imencode(".png", cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    assert success
    return encoded.tobytes()


def test_v1_health():
    """Verify health endpoint reports model readiness."""
    res = client.get("/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["model_name"] == "HeightFormer-RS-v1"
    assert data["model_loaded"] is True
    assert "device" in data


def test_v1_predict_relative_heightmap(sample_overhead_image_bytes):
    """Verify standard relative height map prediction."""
    files = {"image": ("satellite_test.png", sample_overhead_image_bytes, "image/png")}
    res = client.post("/v1/predict", files=files)

    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "completed"
    assert data["prediction_id"].startswith("pred_")
    assert data["model_version"] == "HeightFormer-RS-v1"
    assert data["inference_time_ms"] > 0

    assert data["input"]["width"] == 256
    assert data["input"]["height"] == 256
    assert data["input"]["format"] == "RGB"

    pred = data["prediction"]
    assert pred["type"] == "dense_height_map"
    assert pred["height_units"] == "relative_normalized_0_to_1"
    assert pred["is_calibrated"] is False
    assert pred["statistics"]["min"] >= 0.0
    assert pred["statistics"]["max"] <= 1.0
    assert "/v1/predictions/" in pred["output_url"]


def test_v1_predict_calibrated_metric(sample_overhead_image_bytes):
    """Verify calibrated metric prediction scaling to meters AGL."""
    files = {"image": ("satellite_calib.jpg", sample_overhead_image_bytes, "image/jpeg")}
    params = {"calibrate": "true", "gsd_m": "0.3"}
    res = client.post("/v1/predict", files=files, params=params)

    assert res.status_code == 200
    data = res.json()

    pred = data["prediction"]
    assert pred["height_units"] == "meters_above_ground_level"
    assert pred["is_calibrated"] is True
    assert pred["statistics"]["max"] > 0.0  # Real physical meters


def test_v1_output_retrieval(sample_overhead_image_bytes):
    """Verify downloading output artifacts in all 4 formats."""
    # First generate a prediction
    files = {"image": ("scene.png", sample_overhead_image_bytes, "image/png")}
    pred_res = client.post("/v1/predict", files=files)
    assert pred_res.status_code == 200
    pred_id = pred_res.json()["prediction_id"]

    # 1. Retrieve 16-bit PNG
    res_png = client.get(f"/v1/predictions/{pred_id}/output?format=png")
    assert res_png.status_code == 200
    assert res_png.headers["content-type"] == "image/png"
    assert len(res_png.content) > 100

    # Verify PNG is valid 16-bit image
    nparr = np.frombuffer(res_png.content, np.uint8)
    png_decoded = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    assert png_decoded is not None
    assert png_decoded.dtype == np.uint16
    assert png_decoded.shape == (256, 256)

    # 2. Retrieve GeoTIFF
    res_tif = client.get(f"/v1/predictions/{pred_id}/output?format=tif")
    assert res_tif.status_code == 200
    assert res_tif.headers["content-type"] == "image/tiff"
    assert len(res_tif.content) > 100

    # 3. Retrieve NumPy binary
    res_npy = client.get(f"/v1/predictions/{pred_id}/output?format=npy")
    assert res_npy.status_code == 200
    npy_arr = np.load(io.BytesIO(res_npy.content))
    assert npy_arr.shape == (256, 256)
    assert npy_arr.dtype == np.float32

    # 4. Retrieve JSON metadata
    res_json = client.get(f"/v1/predictions/{pred_id}/output?format=json")
    assert res_json.status_code == 200
    j_meta = res_json.json()
    assert j_meta["prediction_id"] == pred_id
    assert j_meta["width"] == 256


def test_v1_error_handling():
    """Verify clean error responses for invalid files and missing IDs."""
    # 1. Invalid file extension
    files = {"image": ("document.txt", b"plain text", "text/plain")}
    res = client.post("/v1/predict", files=files)
    assert res.status_code == 400
    assert "Unsupported file format" in res.json()["detail"]

    # 2. Empty file
    files = {"image": ("empty.png", b"", "image/png")}
    res_empty = client.post("/v1/predict", files=files)
    assert res_empty.status_code == 400
    assert "empty" in res_empty.json()["detail"].lower()

    # 3. Corrupt image file
    files = {"image": ("corrupt.png", b"not-a-real-png-data", "image/png")}
    res_corrupt = client.post("/v1/predict", files=files)
    assert res_corrupt.status_code == 400
    assert "decode" in res_corrupt.json()["detail"].lower()

    # 4. Non-existent prediction output
    res_404 = client.get("/v1/predictions/pred_nonexistent_9999/output?format=png")
    assert res_404.status_code == 404
    assert "not found" in res_404.json()["detail"].lower()
