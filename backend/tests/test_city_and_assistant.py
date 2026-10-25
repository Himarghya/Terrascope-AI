"""
Comprehensive Unit Tests for City Detail Studio, Procedural Architecture,
Mesh Geometry Validation, Multi-Engine Exporter, ElevenLabs Voice Interface,
and Agent37 Geospatial Assistant Integration.
"""

import os
import sys

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import json
import pytest
import numpy as np

from services.building_classifier import classify_building_structure
from services.procedural_building_service import ProceduralBuildingGenerator
from services.mesh_validation_service import validate_mesh_geometry, validate_city_export_package
from services.city_optimization_service import CityDetailOptimizationService
from services.city_export_service import CityExportService
from services.city_detail_service import CityDetailService
from services.voice_service import ElevenLabsVoiceService
from services.agent37_service import Agent37Service


@pytest.fixture
def sample_building_data():
    return {
        "id": "b_test_001",
        "footprint_area_m2": 450.0,
        "estimated_height_m": 18.5,
        "length_m": 25.0,
        "width_m": 18.0,
        "aspect_ratio": 1.39,
        "shape_regularity": 0.92,
        "polygon_px": [
            [100, 100],
            [150, 100],
            [150, 140],
            [100, 140]
        ],
        "roof_shape": "flat",
        "base_color_hex": "#64748b",
        "has_solar_panels": True,
        "has_hvac_units": True,
    }


@pytest.fixture
def sample_scene_data(sample_building_data):
    return {
        "job_id": "test_city_job",
        "gsd_m": 0.4,
        "dimensions": {"width": 1024, "height": 1024},
        "buildings": [
            sample_building_data,
            {
                "id": "b_test_002",
                "footprint_area_m2": 110.0,
                "estimated_height_m": 6.5,
                "length_m": 11.0,
                "width_m": 10.0,
                "aspect_ratio": 1.1,
                "shape_regularity": 0.95,
                "polygon_px": [
                    [300, 300],
                    [330, 300],
                    [330, 325],
                    [300, 325]
                ],
                "roof_shape": "gabled",
                "base_color_hex": "#b45309",
                "has_solar_panels": False,
                "has_hvac_units": False,
            }
        ],
        "roads": [
            {
                "id": "road_001",
                "centerline_px": [[50, 200], [500, 200]],
                "width_m": 8.0
            }
        ],
        "trees": [
            {
                "id": "tree_001",
                "center_px": [200, 250],
                "canopy_diameter_m": 5.0,
                "estimated_height_m": 7.0
            }
        ],
        "summary_stats": {
            "built_up_area_m2": 560.0
        }
    }


def test_building_classification(sample_building_data):
    """Test classification of structures into realistic architectural archetypes."""
    classification = classify_building_structure(sample_building_data, gsd_m=0.4)
    assert "category" in classification
    assert "estimated_floors" in classification
    assert classification["estimated_floors"] >= 4  # 18.5m height is ~5 floors
    assert classification["category"] in ("office_building", "apartment_block", "commercial_building", "detached_house")


def test_procedural_building_generation(sample_building_data):
    """Test solid walls, recessed windows, entrance doors, and collision hulls."""
    gen = ProceduralBuildingGenerator()
    detailed_b = gen.generate_detailed_building(
        building_data=sample_building_data,
        base_elevation_m=0.0,
        gsd_m=0.4,
        img_width=1024,
        img_height=1024,
        detail_tier="high"
    )

    assert detailed_b["building_id"] == "b_test_001"
    assert "walls_mesh" in detailed_b
    assert len(detailed_b["walls_mesh"]["vertices"]) > 0
    assert len(detailed_b["walls_mesh"]["faces"]) > 0

    # Verify components breakdown
    assert "windows" in detailed_b
    assert "roof_mesh" in detailed_b
    assert "doors" in detailed_b

    # Verify Unreal / Unity collision UCX hull
    ucx = detailed_b["collision_mesh"]
    assert ucx["type"] == "collision_hull"
    assert len(ucx["vertices"]) >= 8
    assert len(ucx["faces"]) >= 12

    # Verify geometry validation report
    val = validate_mesh_geometry(
        vertices=detailed_b["walls_mesh"]["vertices"],
        faces=detailed_b["walls_mesh"]["faces"]
    )
    assert val.is_valid is True
    assert val.degenerate_faces == 0
    assert val.duplicate_faces == 0


def test_city_optimization_and_props(sample_scene_data):
    """Test district-scale detail generation including sidewalks and props."""
    opt = CityDetailOptimizationService()
    city_data = opt.generate_detailed_city(
        scene_data=sample_scene_data,
        detail_tier="medium",
        include_props=True,
        include_sidewalks=True
    )

    assert city_data["building_count"] == 2
    assert len(city_data["street_props"]) > 0
    assert len(city_data["sidewalks"]) > 0
    assert "validation_report" in city_data
    assert city_data["validation_report"]["overall_valid"] is True


def test_multi_engine_exporter(tmp_path, sample_scene_data):
    """Test multi-engine export packaging: GLB, FBX ASCII, OBJ, Blender script, and Manifest."""
    export_dir = str(tmp_path / "exports")
    os.makedirs(export_dir, exist_ok=True)

    city_service = CityDetailService(export_dir)
    city_data = city_service.detail_entire_city(sample_scene_data, detail_tier="medium")

    export_result = city_service.export_city_package(
        scene_data=sample_scene_data,
        formats=["glb", "fbx", "obj", "blender"]
    )

    assert "manifest" in export_result
    manifest = export_result["manifest"]
    assert "TerraScope" in manifest["project_name"]
    assert manifest["building_count"] == 2
    assert "unreal_engine_5" in manifest["engine_compatibility"]

    # Check that export files were generated on disk
    assert "manifest_url" in export_result
    assert "glb_url" in export_result
    assert "fbx_url" in export_result
    assert "blender_script_url" in export_result


def test_voice_service_and_intent_routing(sample_scene_data):
    """Test ElevenLabs voice service intent parser and natural language summaries across all 9 commands."""
    voice = ElevenLabsVoiceService()

    # Spoken analysis summary
    spoken_summary = voice.generate_spoken_analysis_summary(sample_scene_data)
    assert "TerraScope geospatial reconstruction complete" in spoken_summary
    assert "2 structural buildings" in spoken_summary

    # 1. Analyze this satellite image
    c1 = voice.route_voice_command("Analyze this satellite image", sample_scene_data)
    assert c1["action"] == "analyze_scene"
    assert "2" in c1["response_text"]

    # 2. Show me the buildings detected in this area
    c2 = voice.route_voice_command("Show me the buildings detected in this area", sample_scene_data)
    assert c2["action"] == "highlight_buildings"
    assert "2 structural buildings" in c2["response_text"]

    # 3. What is the estimated height of the selected building?
    c3 = voice.route_voice_command(
        "What is the estimated height of the selected building?",
        sample_scene_data,
        selected_building_id="b_test_001"
    )
    assert c3["action"] == "focus_building"
    assert "18.5" in c3["response_text"]

    # 4. Compare the before and after images (no disaster data yet)
    c4 = voice.route_voice_command("Compare the before and after images", sample_scene_data)
    assert c4["action"] == "compare_bitemporal"
    assert "disaster assessment" in c4["response_text"].lower()

    # 5. Highlight the areas that changed
    c5 = voice.route_voice_command("Highlight the areas that changed", sample_scene_data)
    assert c5["action"] == "highlight_changes"

    # 6. Summarize the terrain analysis
    c6 = voice.route_voice_command("Summarize the terrain analysis", sample_scene_data)
    assert c6["action"] == "summarize_terrain"
    assert "topography" in c6["response_text"].lower() or "slope" in c6["response_text"].lower()

    # 7. Explain the confidence of this prediction
    c7 = voice.route_voice_command("Explain the confidence of this prediction", sample_scene_data)
    assert c7["action"] == "explain_confidence"
    assert "confidence" in c7["response_text"].lower() or "accuracy" in c7["response_text"].lower()

    # 8. Generate a report for this analysis
    c8 = voice.route_voice_command("Generate a report for this analysis", sample_scene_data)
    assert c8["action"] == "generate_report"
    assert "TerraScope" in c8["response_text"]

    # 9. Stop speaking
    c9 = voice.route_voice_command("Stop speaking", sample_scene_data)
    assert c9["action"] == "stop_audio"
    assert "stopped" in c9["response_text"].lower()


def test_agent37_approved_tools_and_fallback(sample_scene_data):
    """Test Agent37 approved tools and deterministic geospatial reasoning."""
    agent = Agent37Service()

    # Tool 1: get_analysis_results
    res = agent.get_analysis_results(sample_scene_data)
    assert res["total_buildings"] == 2
    assert res["total_roads"] == 1
    assert res["total_trees"] == 1

    # Tool 2: get_building_details
    b_det = agent.get_building_details(sample_scene_data, "b_test_001")
    assert b_det["building_id"] == "b_test_001"
    assert b_det["estimated_height_m"] == 18.5

    # Explain scene with deterministic fallback
    explanation = agent.explain_scene(
        user_prompt="Summarize the building heights in this area",
        scene_data=sample_scene_data,
        selected_building_id="b_test_001"
    )

    assert "explanation" in explanation
    assert "18.5" in explanation["explanation"]
    assert "verified_tools_used" in explanation
    assert len(explanation["verified_tools_used"]) > 0
