"""
Unit and Integration Tests for Persistent Agent37 Worker & Investigation Service.
"""

import os
import sys

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import pytest
from services.agent37_service import Agent37Service
from services.investigation_service import InvestigationService


@pytest.fixture
def mock_scene_data():
    return {
        "job_id": "test_job_101",
        "sample_id": "jacksonville_aerial",
        "gsd_m": 0.15,
        "gsd_source": "calibrated",
        "buildings": [
            {
                "id": "bldg_1",
                "estimated_height_m": 18.5,
                "height_uncertainty_m": 0.8,
                "estimated_floors": 6,
                "footprint_area_m2": 420.0,
                "roof_shape": "Flat",
                "roof_material": "Built-up Bitumen",
                "has_hvac_units": True,
                "has_solar_panels": False,
                "base_elevation": 2.4
            },
            {
                "id": "bldg_2",
                "estimated_height_m": 8.2,
                "height_uncertainty_m": 0.5,
                "estimated_floors": 2,
                "footprint_area_m2": 150.0,
                "roof_shape": "Gabled",
                "roof_material": "Terracotta Tile",
                "has_hvac_units": False,
                "has_solar_panels": True,
                "base_elevation": 2.1
            }
        ],
        "roads": [{"id": "road_1"}],
        "trees": [{"id": "tree_1"}],
        "terrain_stats": {
            "min_elevation_m": 2.1,
            "max_elevation_m": 14.8,
            "mean_slope_deg": 4.5
        },
        "summary_stats": {
            "built_up_area_m2": 570.0
        }
    }


def test_agent37_greeting_is_conversational_not_terrain(mock_scene_data):
    service = Agent37Service()
    # User types "helloe" (exact prompt from user screenshot)
    resp = service.explain_scene("helloe", mock_scene_data)

    assert resp["status"] == "SUCCESS"
    assert "0.0m to 0.0m" not in resp["reply"]
    assert "Agent37" in resp["reply"]
    assert "investigation" in resp["reply"].lower()
    assert "get_analysis_capabilities" in resp["verified_tools_used"]


def test_investigation_persistence_and_resume():
    inv_service = InvestigationService()
    record = inv_service.create_investigation(
        area_name="test_coastal_sector",
        objectives=["3D Extraction", "Hazard Check"]
    )
    inv_id = record["investigation_id"]

    # Verify retrieval
    loaded = inv_service.get_investigation(inv_id)
    assert loaded is not None
    assert loaded["area_name"] == "test_coastal_sector"
    assert len(loaded["pending_tasks"]) > 0

    # Record operation
    updated = inv_service.record_operation(
        inv_id, "get_analysis_results", "Verified 24 buildings", status="SUCCESS"
    )
    assert len(updated["completed_operations"]) == 1

    # Resume investigation
    res = inv_service.resume_investigation(inv_id)
    assert res["status"] == "RESUMED"
    assert "get_analysis_results" in res["completed_operations"]

    # Clean up
    inv_service.delete_investigation(inv_id)
    assert inv_service.get_investigation(inv_id) is None


def test_agent37_workflow_a_area_assessment(mock_scene_data):
    service = Agent37Service()
    resp = service.explain_scene("Analyze this area", mock_scene_data)

    assert resp["status"] == "SUCCESS"
    assert resp["action_triggered"] == "SHOW_BUILDINGS"
    assert "get_analysis_results" in resp["verified_tools_used"]
    assert "2 structural buildings" in resp["reply"] or "2" in resp["reply"]
    assert "investigation" in resp["reply"].lower() or "inv_" in resp.get("investigation_id", "")


def test_agent37_workflow_c_continue_investigation(mock_scene_data):
    service = Agent37Service()
    resp = service.explain_scene("Continue my previous investigation", mock_scene_data)

    assert resp["status"] == "SUCCESS"
    assert "resume_investigation" in resp["verified_tools_used"]
    assert "resumed" in resp["reply"].lower()


def test_agent37_workflow_d_building_inspection(mock_scene_data):
    service = Agent37Service()
    resp = service.explain_scene("What is the height of building 1?", mock_scene_data)

    assert resp["status"] == "SUCCESS"
    assert resp["action_triggered"] == "FOCUS_BUILDING"
    assert "18.5" in resp["reply"]
    assert "get_building_details" in resp["verified_tools_used"]


def test_agent37_model_discovery_and_catalog():
    service = Agent37Service()
    catalog = service.get_model_catalog()

    assert catalog["status"] == "SUCCESS"
    assert catalog["default_model"] == "agent37-hermes:default"
    assert len(catalog["available_models"]) >= 4
    assert len(catalog["scientific_models"]) >= 2

    # Verify model roles and restrictions
    scientific_ids = [m["id"] for m in catalog["scientific_models"]]
    assert "terrascope-resnet50-unet:height_v2.pt" in scientific_ids

    restrictions = catalog["account_restrictions"]
    assert restrictions["paid_key_verified"] is True
    assert restrictions["instance_creation_policy"] == "EXPLICIT_USER_APPROVAL_REQUIRED"


def test_agent37_model_provenance_and_usage_logging(mock_scene_data):
    service = Agent37Service()
    resp = service.explain_scene("Analyze this area", mock_scene_data)

    assert resp["status"] == "SUCCESS"
    assert "model_used" in resp
    assert "configured_model" in resp
    assert "scientific_models_used" in resp
    assert "terrascope-resnet50-unet:height_v2.pt" in resp["scientific_models_used"]

    # Verify model identifier recorded in durable investigation record
    inv_id = resp["investigation_id"]
    inv = service.investigation_service.get_investigation(inv_id)
    assert inv is not None
    completed = inv.get("completed_operations", [])
    assert len(completed) > 0
    assert "model_identifier" in completed[-1]
    assert completed[-1]["task_status"] == "VERIFIED_COMPLETED"

    # Clean up
    service.investigation_service.delete_investigation(inv_id)


def test_request_earthquake_analysis_intent(mock_scene_data):
    service = Agent37Service()
    resp = service.explain_scene("Simulate a magnitude 6.5 earthquake scenario for this neighborhood", mock_scene_data)

    assert resp["status"] == "SUCCESS"
    assert "request_earthquake_analysis" in resp["verified_tools_used"]
    assert resp["action_triggered"] == "SHOW_HAZARD_SIMULATION"
    assert "Peak Ground Acceleration" in resp["reply"] or "PGA" in resp["reply"]
    assert "Modified Mercalli" in resp["reply"] or "MMI" in resp["reply"]
    assert "Joyner-Boore" in resp["reply"]
    assert "limitations" in resp["reply"].lower() or "disclaimer" in resp["reply"].lower()

    # Clean up
    service.investigation_service.delete_investigation(resp["investigation_id"])


def test_compare_earthquake_scenarios_intent(mock_scene_data):
    service = Agent37Service()
    resp = service.explain_scene("Compare earthquake scenario 5.5 and 7.2", mock_scene_data)

    assert resp["status"] == "SUCCESS"
    assert "compare_earthquake_scenarios" in resp["verified_tools_used"]
    assert resp["action_triggered"] == "SHOW_HAZARD_SIMULATION"
    assert "Scenario A (Magnitude 5.5)" in resp["reply"] or "5.5" in resp["reply"]
    assert "Scenario B (Magnitude 7.2)" in resp["reply"] or "7.2" in resp["reply"]
    assert "differential" in resp["reply"].lower() or "additional" in resp["reply"].lower()
    assert "assumptions" in resp["reply"].lower()

    # Clean up
    service.investigation_service.delete_investigation(resp["investigation_id"])


def test_end_to_end_cross_session_task_persistence(mock_scene_data):
    """
    Demonstrates a complete end-to-end workflow:
    1. Turn 1 (Session 1): User requests earthquake analysis. Tool runs on backend,
       records result, and associates a session ID.
    2. Turn 2 (Session 2 / later session): Agent resumes investigation, retrieves
       saved task results and project data from durable storage across turns.
    """
    service = Agent37Service()
    
    # Session 1: Execute earthquake analysis and save result
    resp1 = service.explain_scene("Run seismic earthquake analysis magnitude 6.8", mock_scene_data)
    inv_id = resp1["investigation_id"]
    assert "request_earthquake_analysis" in resp1["verified_tools_used"]

    # Verify durable record exists
    inv_rec = service.investigation_service.get_investigation(inv_id)
    assert inv_rec is not None
    assert any(op["operation"] == "request_earthquake_analysis" for op in inv_rec["completed_operations"])

    # Simulate cross-session retrieval: In a later session, ask to continue/resume
    resp2 = service.explain_scene("Resume previous investigation and continue tasks", mock_scene_data)
    assert resp2["status"] == "SUCCESS"
    assert "resume_investigation" in resp2["verified_tools_used"]
    assert inv_id in resp2["reply"] or "resumed" in resp2["reply"].lower()

    # Clean up
    service.investigation_service.delete_investigation(inv_id)
