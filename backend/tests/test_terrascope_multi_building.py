"""
Acceptance Test for TERRASCOPE AI Multi-Building 2D-to-3D Reconstruction.
Validates multi-building detection, typologies, 3D meshes, and export packaging
on a benchmark dataset containing at least 20 visible buildings.
"""

import os
import sys
import numpy as np
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.sample_generator import create_terrascope_metro_complex_sample, ensure_sample_datasets
from core.image_loader import inspect_image_file, load_image_rgb
from core.preprocessor import enhance_satellite_image
from core.landcover import classify_landcover
from core.building_detector import segment_building_instances, extract_building_inventory
from core.vegetation_detector import extract_individual_tree_crowns
from core.mesh_generator import (
    generate_building_3d_mesh,
    prepare_vegetation_3d_instances,
    export_scene_to_glb,
    export_scene_to_obj,
    export_features_to_geojson,
    export_metadata_json
)
from services.height_estimation import SingleImageHeightEstimator


def test_terrascope_metro_complex_acceptance(tmp_path):
    """
    Acceptance Criteria:
    1. Input image contains at least 20 visible buildings of varying heights and shapes.
    2. All detected structures receive unique IDs (B001, B002, ...) and typology classifications.
    3. Every building has true 3D geometry with vertices and faces (not flat planes).
    4. Successful generation and export of GLB, OBJ, GeoJSON, and metadata JSON.
    """
    # 1. Synthesize Terrascope Metro Complex (1024x1024, 28 distinct buildings)
    sample_path = str(tmp_path / "terrascope_metro_complex.png")
    create_terrascope_metro_complex_sample(sample_path)
    assert os.path.exists(sample_path)

    # 2. Inspect image
    metadata = inspect_image_file(sample_path)
    assert metadata["dimensions"]["width"] == 1024
    assert metadata["dimensions"]["height"] == 1024
    actual_gsd = metadata.get("gsd_m", 0.4)

    # 3. Load & Preprocess
    rgb = load_image_rgb(sample_path)
    enhanced = enhance_satellite_image(rgb)

    # 4. Land-Cover Classification
    class_map, conf_map, stats = classify_landcover(enhanced)
    building_mask = (class_map == 4).astype(np.uint8)
    shadow_mask = (class_map == 7).astype(np.uint8)
    tree_mask = (class_map == 3).astype(np.uint8)

    # 5. Building Segmentation & Inventory
    instance_map, instances = segment_building_instances(building_mask, min_area_px=25)
    buildings = extract_building_inventory(instance_map, instances, rgb, shadow_mask, gsd_m=actual_gsd)

    # PRIMARY ACCEPTANCE TEST: Must detect AT LEAST 20 buildings
    print(f"Total buildings detected: {len(buildings)}")
    assert len(buildings) >= 20, f"Expected at least 20 buildings, detected {len(buildings)}"

    # Check ID format (B001, B002...) and typology
    for b in buildings:
        assert b["id"].startswith("B"), f"Building ID should start with B, got {b['id']}"
        assert "building_type" in b
        assert b["building_type"] in [
            "High-Rise Commercial Tower",
            "Industrial Logistics / Warehouse",
            "Commercial Office / Retail Center",
            "Multi-Family Residential / Apartment",
            "Institutional / Public Facility",
            "Residential Single-Family / Villa",
            "Mixed-Use Urban Structure"
        ]
        assert b["estimated_height_m"] > 0
        assert len(b["polygon_px"]) >= 3

    # 6. Tree Crowns
    _, trees = extract_individual_tree_crowns(rgb, tree_mask, gsd_m=actual_gsd)
    assert len(trees) >= 15, f"Expected at least 15 trees, detected {len(trees)}"

    # 7. SIHE Height Estimation
    sihe = SingleImageHeightEstimator()
    sihe_out = sihe.run_sihe_pipeline(
        rgb,
        gsd_m=actual_gsd,
        solar_azimuth=135.0,
        solar_elevation=45.0,
        buildings=buildings,
        trees=trees,
        shadow_mask=shadow_mask,
        output_dir=str(tmp_path),
        job_id="acceptance_test"
    )
    dem = sihe_out["dem"]
    assert dem.shape == (1024, 1024)
    assert sihe_out["calibration"]["is_calibrated"] is True

    # 8. 3D Mesh Generation for Every Building
    meshes_3d = []
    for b in buildings:
        m = generate_building_3d_mesh(b, 1024, 1024, actual_gsd, dem)
        assert m is not None
        assert len(m["vertices"]) >= 8, f"Building {b['id']} must have 3D volume vertices"
        assert len(m["faces"]) >= 6, f"Building {b['id']} must have 3D faces"
        meshes_3d.append(m)

    assert len(meshes_3d) == len(buildings)

    # 9. Vegetation 3D Instances
    veg_3d = prepare_vegetation_3d_instances(trees, 1024, 1024, actual_gsd, dem)
    assert len(veg_3d) == len(trees)

    # 10. Multi-Format Exports
    glb_path = str(tmp_path / "scene.glb")
    export_scene_to_glb(meshes_3d, veg_3d, dem, 1024, 1024, actual_gsd, glb_path)
    assert os.path.exists(glb_path)
    assert os.path.getsize(glb_path) > 1000

    obj_path = str(tmp_path / "scene.obj")
    export_scene_to_obj(meshes_3d, veg_3d, dem, 1024, 1024, actual_gsd, obj_path)
    assert os.path.exists(obj_path)
    assert os.path.getsize(obj_path) > 1000

    geojson_path = str(tmp_path / "features.geojson")
    export_features_to_geojson(buildings, trees, 1024, 1024, actual_gsd, dem, geojson_path)
    assert os.path.exists(geojson_path)
    assert os.path.getsize(geojson_path) > 1000

    metadata_path = str(tmp_path / "metadata.json")
    export_metadata_json({
        "job_id": "acceptance_test",
        "total_buildings": len(buildings),
        "total_trees": len(trees),
        "gsd_m": actual_gsd,
        "calibration": sihe_out["calibration"]
    }, metadata_path)
    assert os.path.exists(metadata_path)
    assert os.path.getsize(metadata_path) > 100
