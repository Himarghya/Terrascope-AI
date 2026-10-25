"""
Unit and Integration Tests for:
1. Insurance Risk Assessment Engine & API
2. 2D-to-3D Model Inference API (Height, Buildings, Classification, Terrain)
"""

import os
import sys
import numpy as np
import cv2
import pytest
from fastapi.testclient import TestClient

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from core.insurance_risk_engine import InsuranceRiskEngine

client = TestClient(app)


@pytest.fixture
def sample_test_image_bytes():
    """Generates an in-memory synthetic 128x128 RGB overhead image."""
    img = np.zeros((128, 128, 3), dtype=np.uint8)
    img[:] = [90, 120, 70]
    # Building 1
    img[20:60, 20:60] = [220, 215, 200]
    # Building 2
    img[70:110, 70:110] = [170, 85, 65]
    success, encoded = cv2.imencode(".png", cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    assert success
    return encoded.tobytes()


def test_insurance_engine_logic():
    """Tests InsuranceRiskEngine calculations, tier boundaries, and disclaimers."""
    engine = InsuranceRiskEngine()
    fake_scene = {
        "filename": "test_aerial.png",
        "sample_id": "jacksonville_aerial",
        "gsd_m": 0.35,
        "buildings": [
            {
                "id": "B1",
                "estimated_height_m": 12.0,
                "stories": 4,
                "footprint_area_m2": 250.0,
                "roof_shape": "Flat",
                "flood_susceptibility": 0.65,
                "seismic_pga_g": 0.25,
                "landslide_susceptibility": 0.05
            },
            {
                "id": "B2",
                "estimated_height_m": 6.5,
                "stories": 2,
                "footprint_area_m2": 110.0,
                "roof_shape": "Pitched",
                "flood_susceptibility": 0.20,
                "seismic_pga_g": 0.15,
                "landslide_susceptibility": 0.02
            }
        ],
        "summary_stats": {
            "mean_building_height_m": 9.25,
            "max_building_height_m": 12.0,
            "building_density_pct": 28.5,
            "built_up_area_m2": 360.0
        },
        "terrain_stats": {
            "elevation_range_m": 4.5,
            "elevation_min_m": 1.2,
            "elevation_max_m": 5.7,
            "mean_slope_deg": 1.5,
            "max_slope_deg": 3.8
        }
    }

    report = engine.evaluate_scene_insurance_risk(fake_scene, sample_id="jacksonville_aerial")

    assert "report_id" in report
    assert 0.0 <= report["overall_risk_score"] <= 100.0
    assert report["underwriting_tier"]["code"] in [
        "TIER_1_PREFERRED", "TIER_2_STANDARD", "TIER_3_ELEVATED", "TIER_4_HIGH_RISK"
    ]
    assert "flood" in report["hazard_scores"]
    assert "earthquake" in report["hazard_scores"]
    assert "landslide" in report["hazard_scores"]
    assert "structural" in report["hazard_scores"]
    assert len(report["building_schedule"]) == 2
    assert report["total_buildings_evaluated"] == 2
    assert len(report["data_gaps"]) >= 3
    assert len(report["recommendations"]) >= 3
    assert "PRELIMINARY INSURANCE RISK SCREENING ONLY" in report["legal_disclaimer"]
    assert report["historical_hazard_information"]["historical_records_available"] is True


def test_insurance_api_endpoints():
    """Tests /api/insurance/assess and /api/insurance/sample-report."""
    # 1. Sample report
    res = client.get("/api/insurance/sample-report?sample_id=jacksonville_aerial")
    assert res.status_code == 200
    data = res.json()
    assert "overall_risk_score" in data
    assert "underwriting_tier" in data
    assert len(data["building_schedule"]) > 0

    # 2. Assess endpoint with custom weights
    payload = {
        "sample_id": "jacksonville_aerial",
        "custom_weights": {"flood": 0.5, "earthquake": 0.2, "landslide": 0.1, "structural": 0.2},
        "rainfall_mm_hr": 45.0
    }
    res2 = client.post("/api/insurance/assess", json=payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["hazard_scores"]["flood"]["weight"] == 0.5
    assert data2["overall_risk_score"] >= 0.0


def test_2d_to_3d_api_predict_and_heights(sample_test_image_bytes):
    """Tests POST /v1/2d-to-3d/predict with image upload returning 3D building heights."""
    files = {"image": ("test_site.png", sample_test_image_bytes, "image/png")}
    data = {"gsd_m": "0.35", "include_terrain_mesh": "true", "run_async": "false"}

    res = client.post("/v1/2d-to-3d/predict", files=files, data=data)
    assert res.status_code == 200
    res_data = res.json()

    assert res_data["status"] == "completed"
    assert "prediction_id" in res_data
    assert "summary" in res_data
    assert "building_count" in res_data["summary"]
    assert "mean_building_height_m" in res_data["summary"]
    assert "classification_outputs" in res_data
    assert "vegetation_coverage_pct" in res_data["classification_outputs"]
    assert "building_density_pct" in res_data["classification_outputs"]
    assert "terrain_stats" in res_data
    assert "terrain_mesh" in res_data
    assert "artifacts" in res_data
    assert "/v1/predictions/" in res_data["artifacts"]["heightmap_png_url"]


def test_2d_to_3d_api_with_sample_id():
    """Tests POST /v1/2d-to-3d/predict via sample_id parameter."""
    data = {"sample_id": "jacksonville_aerial", "include_terrain_mesh": "false", "run_async": "false"}
    res = client.post("/v1/2d-to-3d/predict", data=data)
    assert res.status_code == 200
    res_data = res.json()

    assert res_data["status"] == "completed"
    assert res_data["summary"]["building_count"] > 0
    assert len(res_data["buildings"]) > 0
    # Verify building height extraction
    first_bld = res_data["buildings"][0]
    assert "height_m" in first_bld or "estimated_height_m" in first_bld
    b_h = float(first_bld.get("height_m", first_bld.get("estimated_height_m", 0.0)))
    assert b_h > 0.0


def test_2d_to_3d_api_aliased_under_api_prefix():
    """Verifies that /api/v1/2d-to-3d/predict is also mounted and functional."""
    data = {"sample_id": "jacksonville_aerial"}
    res = client.post("/api/v1/2d-to-3d/predict", data=data)
    assert res.status_code == 200
    assert res.json()["status"] == "completed"
