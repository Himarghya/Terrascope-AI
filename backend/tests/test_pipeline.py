"""
Unit Tests for Satellite-to-3D Reconstruction Pipeline.
Tests geometry transforms, roof classification, building detection,
and terrain mesh generation.
"""

import os
import sys
import numpy as np
import pytest

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.landcover import classify_landcover, compute_spectral_indices
from core.building_detector import (
    segment_building_instances,
    classify_roof_and_features,
    estimate_building_height_from_shadow
)
from core.vegetation_detector import extract_individual_tree_crowns
from core.terrain_modeler import generate_relative_elevation_model, generate_terrain_mesh_data
from core.mesh_generator import pixel_to_world, generate_building_3d_mesh


def test_spectral_indices():
    """Tests Excess Green and water index computation."""
    # Synthetic image with green grass, dark water, and gray road
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    img[:50, :50] = [30, 180, 40]  # Green grass
    img[50:, 50:] = [20, 60, 150]  # Blue water

    indices = compute_spectral_indices(img)
    assert "exg" in indices
    assert "water_idx" in indices
    # Grass should have positive ExG
    assert np.mean(indices["exg"][:50, :50]) > 0.1
    # Water should have high water index
    assert np.mean(indices["water_idx"][50:, 50:]) > 0.05


def test_pixel_to_world_transform():
    """Tests metric coordinate transformations."""
    dem = np.zeros((200, 200), dtype=np.float32)
    dem[100, 100] = 15.5

    # Center pixel (100, 100) should map to world origin (0, 15.5, 0)
    xw, yw, zw = pixel_to_world(100, 100, 200, 200, gsd_m=0.5, dem=dem)
    assert xw == 0.0
    assert yw == 15.5
    assert zw == 0.0

    # East pixel (120, 100) should be +10m East
    xw_e, _, _ = pixel_to_world(120, 100, 200, 200, gsd_m=0.5, dem=dem)
    assert xw_e == 10.0


def test_building_instance_watershed():
    """Tests separating two adjacent buildings."""
    mask = np.zeros((100, 100), dtype=np.uint8)
    # Two adjacent 20x20 squares touching slightly
    mask[20:40, 20:40] = 255
    mask[20:40, 42:62] = 255

    instance_map, instances = segment_building_instances(mask, min_area_px=20)
    assert len(instances) == 2
    assert instances[0]["id_num"] != instances[1]["id_num"]


def test_building_3d_mesh_generation():
    """Tests 3D mesh vertex and face generation for a building."""
    dem = np.zeros((200, 200), dtype=np.float32)
    bld = {
        "id": "BLD-001",
        "polygon_px": [[40, 40], [80, 40], [80, 70], [40, 70]],
        "estimated_height_m": 8.0,
        "roof_shape": "Gabled / Pitched Roof",
        "base_color_hex": "#c25a38",
        "width_m": 12.0
    }

    mesh = generate_building_3d_mesh(bld, 200, 200, 0.4, dem)
    assert "vertices" in mesh
    assert "faces" in mesh
    assert len(mesh["vertices"]) > 8  # 4 bottom + 4 eave + 1 ridge
    assert len(mesh["faces"]) > 6
    assert mesh["total_height"] == 8.0


def test_terrain_mesh_data():
    """Tests DEM grid subsampling."""
    dem = np.random.uniform(10.0, 30.0, (200, 200)).astype(np.float32)
    tdata = generate_terrain_mesh_data(dem, grid_res=64)
    assert tdata["grid_width"] == 64
    assert tdata["grid_height"] == 64
    assert len(tdata["elevations"]) == 64 * 64


def test_auto_gsd_estimation():
    """Tests automatic meters-per-pixel estimation from building roofs and roads."""
    from core.geodepth_pipeline import GeoDepthPipeline
    pipe = GeoDepthPipeline()

    rgb = np.zeros((300, 300, 3), dtype=np.uint8)
    seg = np.zeros((300, 300), dtype=np.uint8)

    # Draw synthetic road corridor (width = 14 px)
    # At 7m standard width, 14 px corresponds to 0.50 m/px
    seg[:, 140:154] = 3

    # Draw a grid of 3x3 houses (each 17x17 px with alleys)
    # At 8.5m standard width, 17 px corresponds to 0.50 m/px
    for ry in range(3):
        for rx in range(3):
            y0 = 30 + ry * 35
            x0 = 30 + rx * 35
            seg[y0:y0 + 17, x0:x0 + 17] = 2
            rgb[y0:y0 + 17, x0:x0 + 17] = [180, 80, 50]

    auto_gsd, source, est = pipe.estimate_auto_gsd(rgb, seg)
    assert 0.40 <= auto_gsd <= 0.60
    assert "Auto-Estimated" in source


def test_cluster_houses_separation():
    """Tests that touching houses in a dense cluster are split into individual buildings."""
    from core.geodepth_pipeline import GeoDepthPipeline
    pipe = GeoDepthPipeline()

    rgb = np.zeros((200, 200, 3), dtype=np.uint8)
    seg = np.zeros((200, 200), dtype=np.uint8)
    hgt = np.zeros((200, 200), dtype=np.float32)

    # 4 touching houses forming a 2x2 cluster block of 40x40 px
    # Without watershed, this would be 1 single mega-polygon of area 1600 px
    seg[40:80, 40:80] = 2
    hgt[40:80, 40:80] = 6.0
    rgb[40:80, 40:80] = [160, 90, 70]
    # Subtle gutter seam between them
    rgb[59:61, 40:80] = [60, 60, 60]
    rgb[40:80, 59:61] = [60, 60, 60]

    buildings = pipe.extract_buildings(seg, hgt, rgb, gsd_m=0.35, min_area_m2=2.5)
    # Must separate into multiple distinct building instances (not 1 giant blob)
    assert len(buildings) >= 2
    # Individual house areas must be much smaller than the 1600 px block
    for b in buildings:
        assert b["area_m2"] < (1600 * (0.35 ** 2))

