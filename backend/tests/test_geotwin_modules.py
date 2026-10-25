"""
Automated Test Suite for GeoTwin ResponseOS Unified AI Modules (Modules B, C, D, E, F, G)
"""

import os
import sys
import numpy as np
import pytest
from fastapi.testclient import TestClient

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from core.geodepth_pipeline import GeoDepthPipeline
from core.disaster_assessment import DisasterDamageEngine
from core.hazard_predictor import TerrainHazardEngine
from core.safe_route_engine import SafeRouteEngine
from core.wireless_planner import WirelessPropagationEngine
from core.unified_intelligence import UnifiedGeoTwinHub


def _make_synthetic_urban_scene(h: int = 160, w: int = 160):
    """Creates a deterministic synthetic urban + valley + hill scene for unit testing."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # Valley on left-center (x ~ 45), hill on right (x ~ 125)
    dem = (100.0 + 18.0 * np.exp(-((xx - 125.0) ** 2 + (yy - 80.0) ** 2) / (2.0 * 32.0 ** 2))
           - 4.5 * np.exp(-((xx - 45.0) ** 2) / (2.0 * 16.0 ** 2))).astype(np.float32)

    seg = np.zeros((h, w), dtype=np.uint8)
    # Roads grid (seg == 3)
    seg[30:36, :] = 3
    seg[80:86, :] = 3
    seg[130:136, :] = 3
    seg[:, 30:36] = 3
    seg[:, 85:91] = 3
    seg[:, 135:141] = 3

    # Vegetation (seg == 1)
    seg[42:58, 42:58] = 1
    seg[95:115, 100:120] = 1

    # Buildings (seg == 2)
    hgt = np.zeros((h, w), dtype=np.float32)
    # BLD 1 (near trees)
    seg[42:62, 62:80] = 2
    hgt[42:62, 62:80] = 12.5
    # BLD 2 (in flood valley)
    seg[92:114, 42:64] = 2
    hgt[92:114, 42:64] = 8.0
    # BLD 3 (high-rise on high ground)
    seg[44:68, 102:126] = 2
    hgt[44:68, 102:126] = 24.0

    rgb = np.full((h, w, 3), 150, dtype=np.uint8)
    rgb[seg == 1] = [45, 135, 55]
    rgb[seg == 2] = [185, 175, 165]
    rgb[seg == 3] = [95, 95, 100]

    return rgb, seg, dem, hgt


def test_module_b_building_intelligence_attributes():
    rgb, seg, dem, hgt = _make_synthetic_urban_scene()
    pipe = GeoDepthPipeline()
    buildings = pipe.extract_buildings(seg, hgt, rgb, gsd_m=0.5, min_area_m2=8.0)
    assert len(buildings) >= 3

    for b in buildings:
        assert "vegetation_proximity_m" in b
        assert "vegetation_proximity_category" in b
        assert "floor_count_category" in b
        assert b["floor_height_assumption_m"] == 3.2
        assert "roof_appearance_note" in b
        assert 0.50 <= b["confidence"] <= 0.99
        assert "model_version" in b


def test_module_c_bitemporal_disaster_change_detection():
    rgb_pre, seg, dem, hgt_pre = _make_synthetic_urban_scene()
    rgb_post = rgb_pre.copy()
    hgt_post = hgt_pre.copy()

    # Simulate collapse of BLD 2 (y: 92..114, x: 42..64)
    hgt_post[92:114, 42:64] = 1.0
    rng = np.random.default_rng(7)
    rgb_post[92:114, 42:64] = rng.integers(40, 220, size=(22, 22, 3), dtype=np.uint8)

    buildings = [
        {"id": "BLD-001", "polygon_px": [[62, 42], [80, 42], [80, 62], [62, 62]], "estimated_height_m": 12.5, "footprint_area_m2": 90.0},
        {"id": "BLD-002", "polygon_px": [[42, 92], [64, 92], [64, 114], [42, 114]], "estimated_height_m": 8.0, "footprint_area_m2": 121.0},
    ]

    engine = DisasterDamageEngine()
    report = engine.assess_scenes(
        pre_rgb=rgb_pre,
        post_rgb=rgb_post,
        pre_buildings=buildings,
        pre_hgt=hgt_pre,
        post_hgt=hgt_post,
        gsd_m=0.5,
    )

    assert "spatial_alignment" in report
    assert report["spatial_alignment"]["is_spatially_aligned"] is True
    assessed = {b["building_id"]: b for b in report["assessed_buildings"]}
    assert assessed["BLD-001"]["predicted_change_class"] == "No Significant Detected Change"
    assert assessed["BLD-002"]["damage_class"] == 3
    assert assessed["BLD-002"]["pre_crop_b64"].startswith("data:image/png;base64,")
    assert assessed["BLD-002"]["post_crop_b64"].startswith("data:image/png;base64,")


def test_module_d_terrain_hazard_and_spatial_validation():
    rgb, seg, dem, hgt = _make_synthetic_urban_scene()
    buildings = [
        {"id": "BLD-VALLEY", "polygon_px": [[42, 92], [64, 92], [64, 114], [42, 114]], "center_px": [53, 103]},
        {"id": "BLD-HILL", "polygon_px": [[102, 44], [126, 44], [126, 68], [102, 68]], "center_px": [114, 56]},
    ]
    engine = TerrainHazardEngine()
    report = engine.analyze_scene_hazards(
        dem=dem,
        seg=seg,
        rgb=rgb,
        buildings=buildings,
        gsd_m=0.5,
        rainfall_mm_hr=70.0,
        soil_saturation=0.75,
    )

    assert "flood_hazard" in report
    assert "landslide_hazard" in report
    assert "earthquake_hazard" in report
    assert "completely_collapsed_count" in report["earthquake_hazard"]
    assert "estimated_rubble_m3" in report["earthquake_hazard"]
    assert "estimated_displaced_occupants" in report["earthquake_hazard"]
    assert "submerged_buildings_count" in report["flood_hazard"]
    assert "estimated_water_volume_m3" in report["flood_hazard"]
    assert "high_risk_buildings_count" in report["landslide_hazard"]
    assert "validation_metrics" in report
    val = report["validation_metrics"]
    assert "flood_model_spatial_cv" in val
    assert 0.5 <= val["flood_model_spatial_cv"]["roc_auc"] <= 1.0
    assert report["flood_hazard"]["heatmap_png_b64"].startswith("data:image/png;base64,")
    assert report["landslide_hazard"]["heatmap_png_b64"].startswith("data:image/png;base64,")


def test_module_e_safe_route_prediction_and_comparison():
    rgb, seg, dem, hgt = _make_synthetic_urban_scene()
    buildings = [
        {"id": "BLD-001", "polygon_px": [[62, 42], [80, 42], [80, 62], [62, 62]], "estimated_height_m": 12.5, "center_px": [71, 52]},
        {"id": "BLD-002", "polygon_px": [[42, 92], [64, 92], [64, 114], [42, 114]], "estimated_height_m": 18.0, "center_px": [53, 103]},
        {"id": "BLD-003", "polygon_px": [[102, 44], [126, 44], [126, 68], [102, 68]], "estimated_height_m": 24.0, "center_px": [114, 56]},
    ]

    route_engine = SafeRouteEngine()
    res = route_engine.predict_safe_routes(
        rgb=rgb,
        seg=seg,
        dem=dem,
        buildings=buildings,
        gsd_m=0.5,
        start_point=[25, 132],
        destination="high_ground_assembly",
        travel_mode="emergency_vehicle",
        rainfall_mm_hr=75.0,
    )

    assert res["recommended_route"] is not None
    assert res["shortest_route"] is not None
    rec = res["recommended_route"]
    short = res["shortest_route"]
    assert rec["total_distance_m"] > 0
    assert len(rec["waypoints_3d"]) >= 2
    # Recommended route must have lower or equal hazard exposure compared to shortest route
    assert rec["mean_hazard_exposure"] <= short["mean_hazard_exposure"] + 1e-4
    assert "safety_disclaimer" in res["validation_and_limitations"]


def test_module_f_wireless_propagation_and_candidate_ranking():
    rgb, seg, dem, hgt = _make_synthetic_urban_scene()
    buildings = [
        {"id": "BLD-001", "polygon_px": [[62, 42], [80, 42], [80, 62], [62, 62]], "estimated_height_m": 12.5},
        {"id": "BLD-003", "polygon_px": [[102, 44], [126, 44], [126, 68], [102, 68]], "estimated_height_m": 24.0},
    ]
    rf_engine = WirelessPropagationEngine()
    res_mid = rf_engine.predict_wireless_coverage(
        rgb=rgb,
        seg=seg,
        dem=dem,
        hgt=hgt,
        buildings=buildings,
        gsd_m=0.5,
        frequency_ghz=3.5,
        tx_power_dbm=43.0,
        field_measurements=[{"x_px": 40, "y_px": 40, "measured_rsrp_dbm": -78.0}],
    )
    res_6g = rf_engine.predict_wireless_coverage(
        rgb=rgb,
        seg=seg,
        dem=dem,
        hgt=hgt,
        buildings=buildings,
        gsd_m=0.5,
        frequency_ghz=100.0,
        tx_power_dbm=43.0,
    )

    assert res_mid["coverage_kpis"]["mean_path_loss_db"] < res_6g["coverage_kpis"]["mean_path_loss_db"]
    assert res_6g["band_classification"]["is_experimental_6g"] is True
    assert len(res_mid["candidate_sites"]) >= 1
    assert res_mid["coverage_heatmap_b64"].startswith("data:image/png;base64,")
    assert res_mid.get("optimal_placement") is not None


def test_custom_tower_and_user_equipment_link_evaluation():
    rgb, seg, dem, hgt = _make_synthetic_urban_scene()
    buildings = [
        {"id": "BLD-001", "polygon_px": [[62, 42], [80, 42], [80, 62], [62, 62]], "estimated_height_m": 16.5, "category": "Commercial Office"},
        {"id": "BLD-002", "polygon_px": [[90, 42], [110, 42], [110, 62], [90, 62]], "estimated_height_m": 22.0, "category": "Hospital"},
    ]
    rf_engine = WirelessPropagationEngine()

    # Place custom tower at (30, 30) and test user device at (120, 120)
    res = rf_engine.predict_wireless_coverage(
        rgb=rgb,
        seg=seg,
        dem=dem,
        hgt=hgt,
        buildings=buildings,
        gsd_m=0.5,
        towers=[{
            "tower_id": "TEST-BS-01",
            "label": "Test Rooftop Tower",
            "x_px": 30,
            "y_px": 30,
            "antenna_height_agl_m": 35.0,
            "frequency_ghz": 3.5,
            "tx_power_dbm": 43.0,
            "antenna_gain_dbi": 18.0,
        }],
        user_device_point=[120, 120],
        optimize_placement=True,
    )

    assert res["active_towers"][0]["tower_id"] == "TEST-BS-01"
    assert res["active_towers"][0]["x_px"] == 30
    assert res["active_towers"][0]["y_px"] == 30
    assert res.get("optimal_placement") is not None

    ue = res.get("user_evaluation")
    assert ue is not None
    assert ue["user_point_px"] == [120, 120]
    assert ue["distance_3d_m"] > 10.0
    assert -140.0 <= ue["rsrp_dbm"] <= -40.0
    assert "signal_grade" in ue
    assert "estimated_throughput_mbps" in ue
    assert len(ue["ray_path_3d"]) == 2


def test_module_g_unified_hub_and_fastapi_endpoints():
    client = TestClient(app)
    resp = client.post(
        "/api/geotwin/predict-all",
        json={
            "sample_id": "suburban_residential",
            "rainfall_mm_hr": 60.0,
            "soil_saturation": 0.7,
            "travel_mode": "emergency_vehicle",
            "frequency_ghz": 3.5,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "hazards" in data
    assert "safe_routes" in data
    assert "wireless" in data
    assert "governance_and_validation" in data
    assert data["governance_and_validation"]["direct_inference_verification"]["llm_or_chatbot_in_loop"] is False
    assert data["prediction_records_count"] > 0
    rec0 = data["prediction_records"][0]
    for required_field in [
        "object_or_location_id",
        "prediction_type",
        "predicted_value",
        "units",
        "confidence_or_uncertainty",
        "model_version",
        "source_data_references",
        "prediction_timestamp",
        "validation_status",
    ]:
        assert required_field in rec0
