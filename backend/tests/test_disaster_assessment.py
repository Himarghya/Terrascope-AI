"""
Unit and Integration Tests for Disaster Intelligence & Structural Change Assessment Engine.
"""

import os
import sys
import numpy as np
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.disaster_assessment import DisasterAssessmentEngine, DEFAULT_BULKING_FACTOR


def test_disaster_assessment_synthetic_collapse():
    """
    Tests damage classification, delta height collapse, and debris volume calculation
    on a controlled synthetic building scenario.
    """
    engine = DisasterAssessmentEngine()

    h, w = 200, 200
    pre_rgb = np.full((h, w, 3), 180, dtype=np.uint8)
    post_rgb = np.full((h, w, 3), 120, dtype=np.uint8)

    # Building 1: Collapsed building (Destroyed)
    # Pre-height: 12.0m, Post-height: 2.0m (ΔH = 10.0m, 83.3% collapse)
    # Building 2: Intact building (No Damage)
    # Pre-height: 8.0m, Post-height: 8.0m (ΔH = 0.0m, 0% collapse)
    pre_buildings = [
        {
            "id": "BLD-COLLAPSED",
            "polygon_px": [[20, 20], [60, 20], [60, 60], [20, 60]],
            "estimated_height_m": 12.0,
            "footprint_area_m2": 160.0
        },
        {
            "id": "BLD-INTACT",
            "polygon_px": [[100, 100], [140, 100], [140, 140], [100, 140]],
            "estimated_height_m": 8.0,
            "footprint_area_m2": 160.0
        }
    ]

    pre_hgt = np.zeros((h, w), dtype=np.float32)
    pre_hgt[20:60, 20:60] = 12.0
    pre_hgt[100:140, 100:140] = 8.0

    post_hgt = np.zeros((h, w), dtype=np.float32)
    post_hgt[20:60, 20:60] = 2.0   # Collapsed
    post_hgt[100:140, 100:140] = 8.0 # Intact

    res = engine.assess_scenes(
        pre_rgb=pre_rgb,
        post_rgb=post_rgb,
        pre_buildings=pre_buildings,
        pre_hgt=pre_hgt,
        post_hgt=post_hgt,
        gsd_m=0.35
    )

    kpi = res["summary_kpis"]
    assert kpi["total_buildings_assessed"] == 2
    assert kpi["destroyed_count"] == 1
    assert kpi["no_damage_count"] == 1
    assert kpi["total_damaged_structures"] == 1

    b_collapsed = [b for b in res["assessed_buildings"] if b["building_id"] == "BLD-COLLAPSED"][0]
    assert b_collapsed["damage_class"] == 3
    assert b_collapsed["damage_label"] == "Destroyed"
    assert b_collapsed["delta_height_m"] == 10.0
    # Expected debris volume: 160.0 m2 * 10.0 m * 1.30 = 2080.0 m3
    expected_debris = 160.0 * 10.0 * DEFAULT_BULKING_FACTOR
    assert abs(b_collapsed["debris_volume_m3"] - expected_debris) < 1.0

    b_intact = [b for b in res["assessed_buildings"] if b["building_id"] == "BLD-INTACT"][0]
    assert b_intact["damage_class"] == 0
    assert b_intact["damage_label"] == "No Damage"
    assert b_intact["delta_height_m"] == 0.0
    assert b_intact["debris_volume_m3"] == 0.0

    # Verify GeoJSON output structure
    geojson = res["geojson"]
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) == 2
    f0 = geojson["features"][0]
    assert "damage_class" in f0["properties"]
    assert "debris_volume_m3" in f0["properties"]
