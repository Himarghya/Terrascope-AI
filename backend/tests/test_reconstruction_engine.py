"""
Comprehensive Unit & Integration Tests for AI-Powered Satellite-to-3D Reconstruction Engine.
Validates:
1. Road extraction & 3D road corridor mesh generation
2. Building polygon split, merge, and delete operations
3. Evaluation metrics (Precision, Recall, IoU, Height MAE)
4. Image tiling & prediction merging for large imagery
5. Standard /api/reconstruction/* REST API endpoints
"""

import os
import sys
import numpy as np
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app, SCENES, JOBS
from core.road_detector import extract_road_network, generate_road_3d_mesh
from core.building_editor import delete_building_from_scene, merge_buildings_in_scene, split_building_in_scene
from core.evaluation import evaluate_building_reconstruction, compute_polygon_iou
from core.tiling import compute_image_tiles, run_tiled_classification
from core.mesh_generator import triangulate_2d_polygon, generate_building_3d_mesh

client = TestClient(app)


def test_ear_clipping_arbitrary_polygon():
    """Tests ear-clipping on concave L-shaped polygon."""
    l_shape = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (5.0, 5.0), (0.0, 10.0)]
    triangles = triangulate_2d_polygon(l_shape)
    assert len(triangles) == 3, f"L-shape polygon should triangulate into 3 triangles, got {len(triangles)}"
    for tri in triangles:
        assert len(tri) == 3
        assert all(0 <= idx < 5 for idx in tri)


def test_road_network_extraction_and_3d_mesh():
    """Tests road detection, building avoidance, and 3D terrain-following mesh."""
    # Synthetic 200x200 class map: class 5 is road, class 4 is building
    class_map = np.zeros((200, 200), dtype=np.uint8)
    class_map[:, 90:110] = 5  # Vertical road boulevard

    building_mask = np.zeros((200, 200), dtype=np.uint8)
    building_mask[80:120, 85:115] = 255  # Building encroaching into road

    clean_mask, corridors = extract_road_network(class_map, building_mask, gsd_m=0.4, min_road_area_px=50)
    assert len(corridors) >= 1
    assert "id" in corridors[0]
    assert corridors[0]["id"].startswith("R")
    assert corridors[0]["surface_area_m2"] > 0

    # Building area must be subtracted from clean road mask
    assert np.all(clean_mask[85:115, 90:110] == 0)

    # Test 3D Road Mesh
    dem = np.ones((200, 200), dtype=np.float32) * 12.0
    road_mesh = generate_road_3d_mesh(corridors, 200, 200, 0.4, dem)
    assert len(road_mesh["vertices"]) > 0
    assert len(road_mesh["faces"]) > 0
    assert road_mesh["vertices"][0][1] > 12.0  # Includes elevation offset


def test_building_editor_split_and_merge():
    """Tests splitting and merging building polygons with live 3D mesh updates."""
    # Mock scene
    dem = np.zeros((200, 200), dtype=np.float32)
    bld1 = {
        "id": "B001",
        "polygon_px": [[20, 20], [60, 20], [60, 60], [20, 60]],
        "estimated_height_m": 8.0,
        "roof_shape": "Flat Roof with Parapet",
        "base_color_hex": "#c25a38",
        "footprint_area_m2": 256.0,
        "confidence": 0.88,
        "width_m": 16.0,
        "length_m": 16.0
    }
    bld2 = {
        "id": "B002",
        "polygon_px": [[60, 20], [100, 20], [100, 60], [60, 60]],
        "estimated_height_m": 8.0,
        "roof_shape": "Flat Roof with Parapet",
        "base_color_hex": "#c25a38",
        "footprint_area_m2": 256.0,
        "confidence": 0.88,
        "width_m": 16.0,
        "length_m": 16.0
    }

    mesh1 = generate_building_3d_mesh(bld1, 200, 200, 0.4, dem)
    mesh2 = generate_building_3d_mesh(bld2, 200, 200, 0.4, dem)

    scene = {
        "dimensions": {"width": 200, "height": 200},
        "gsd_m": 0.4,
        "buildings": [bld1, bld2],
        "buildings_3d": [mesh1, mesh2],
        "summary_stats": {"total_buildings": 2, "built_up_area_m2": 512.0}
    }

    # 1. Test Merge
    merged = merge_buildings_in_scene(scene, "B001", "B002")
    assert merged is not None
    assert len(scene["buildings"]) == 1
    assert scene["summary_stats"]["total_buildings"] == 1
    assert scene["buildings"][0]["id"] == "B001+002"
    assert len(scene["buildings_3d"]) == 1

    # 2. Test Split
    sub_buildings = split_building_in_scene(scene, "B001+002", split_orientation="major_axis")
    assert sub_buildings is not None
    assert len(sub_buildings) == 2
    assert len(scene["buildings"]) == 2
    assert len(scene["buildings_3d"]) == 2

    # 3. Test Delete
    del_ok = delete_building_from_scene(scene, sub_buildings[0]["id"])
    assert del_ok is True
    assert len(scene["buildings"]) == 1


def test_scientific_evaluation_metrics():
    """Tests precision, recall, IoU, and height error computation."""
    gt = [
        {"id": "GT1", "polygon_px": [[10, 10], [30, 10], [30, 30], [10, 30]], "estimated_height_m": 10.0},
        {"id": "GT2", "polygon_px": [[50, 50], [70, 50], [70, 70], [50, 70]], "estimated_height_m": 15.0}
    ]
    pred = [
        {"id": "P1", "polygon_px": [[10, 10], [30, 10], [30, 30], [10, 30]], "estimated_height_m": 9.5},  # Perfect match, 0.5m error
        {"id": "P2", "polygon_px": [[50, 50], [70, 50], [70, 70], [50, 70]], "estimated_height_m": 16.0}, # Match, 1.0m error
        {"id": "P3", "polygon_px": [[100, 100], [120, 100], [120, 120], [100, 120]], "estimated_height_m": 8.0} # False positive
    ]

    metrics = evaluate_building_reconstruction(pred, gt, iou_match_threshold=0.5)
    assert metrics["true_positives"] == 2
    assert metrics["false_positives"] == 1
    assert metrics["false_negatives"] == 0
    assert metrics["precision"] == round(2 / 3, 3)
    assert metrics["recall"] == 1.0
    assert metrics["mean_intersection_over_union"] == 1.0
    assert metrics["height_mean_absolute_error_m"] == 0.75  # (0.5 + 1.0) / 2


def test_image_tiling_grid():
    """Tests computing overlapping tile bounding boxes for large images."""
    tiles = compute_image_tiles(img_height=1200, img_width=1600, tile_size=512, overlap_px=64)
    assert len(tiles) >= 6
    for t in tiles:
        assert t["w"] <= 512
        assert t["h"] <= 512
        assert t["x1"] <= 1600
        assert t["y1"] <= 1200


def test_standard_reconstruction_api_endpoints():
    """Tests the /api/reconstruction/* endpoints."""
    # 1. Start job with sample dataset
    res_start = client.post(
        "/api/reconstruction/test-job-api/start",
        data={"sample_id": "terrascope_metro_complex", "gsd_m": "0.4"}
    )
    assert res_start.status_code == 200
    assert res_start.json()["status"] == "PROCESSING"

    # 2. Check status
    res_status = client.get("/api/reconstruction/test-job-api/status")
    assert res_status.status_code == 200
    assert "progress" in res_status.json()
