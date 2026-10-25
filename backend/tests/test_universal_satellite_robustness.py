"""
Tests for Universal Scale & Aerial/Satellite Image Robustness.
Verifies that any uploaded image—including zoomed-out Google Maps screenshots with UI chrome,
dense rural village settlements, and urban centers—extracts clean individual 3D buildings
with accurate auto-GSD estimation and zero UI artifacts.
"""

import os
import sys
backend_dir = os.path.join(os.path.dirname(__file__), '..')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import cv2
import numpy as np
import pytest
from core.preprocessor import detect_map_ui_chrome
from core.geodepth_pipeline import GeoDepthPipeline


@pytest.fixture(scope="module")
def pipeline():
    return GeoDepthPipeline()


def test_ui_chrome_detection_masks_overlays():
    # Synthetic image with artificial Google Maps search bar and bottom card
    img = np.full((500, 800, 3), 100, dtype=np.uint8)
    # Top search bar: white rectangle
    img[10:55, 50:400] = 250
    # Bottom transit card: white rectangle
    img[440:480, 200:600] = 250
    
    ui_mask = detect_map_ui_chrome(img)
    assert np.all(ui_mask[15:50, 60:390] == 1), "Top search bar should be masked out"
    assert np.all(ui_mask[445:475, 210:590] == 1), "Bottom card should be masked out"
    assert np.sum(ui_mask[100:400, :]) == 0, "Central scene should not be masked"


def test_real_settlement_image_scale_and_individual_houses(pipeline):
    test_img_path = r"C:/Users/himar/.gemini/antigravity/brain/76000530-86a8-45e1-935b-a83dce89150b/.user_uploaded/media_1792410887698_d601c7f1.jpg"
    if not os.path.exists(test_img_path):
        pytest.skip("Test image not present in environment")
        
    img = cv2.imread(test_img_path)
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # 1. Infer adaptive multiscale
    seg, hgt, gsd_used = pipeline.infer_adaptive_multiscale(rgb)
    
    # 2. Auto-estimate GSD
    auto_gsd, gsd_source, _ = pipeline.estimate_auto_gsd(rgb, seg, default_gsd=gsd_used)
    
    # Actual GSD for this ~2km wide map screenshot is around 1.6 - 2.2 m/px
    assert 1.4 <= auto_gsd <= 2.5, f"Expected GSD in range [1.4, 2.5] m/px, got {auto_gsd}"
    assert "Building Roofs" in gsd_source or "Roofs" in gsd_source
    
    # 3. Extract individual buildings
    buildings = pipeline.extract_buildings(seg, hgt, rgb, gsd_m=auto_gsd)
    
    # The entire settlement should yield hundreds of clean individual buildings without false field plots
    assert len(buildings) >= 250, f"Expected at least 250 individual houses, got {len(buildings)}"
    
    # Verify that the giant Google Maps search bar (> 1500 m2) was not extracted as a mega-building
    top_search_blds = [b for b in buildings if b['center_px'][1] < 50 and b['area_m2'] > 1500]
    assert len(top_search_blds) == 0, f"UI search bar should not be extracted as building: {top_search_blds}"

    
    # Verify physical heights are realistic (>= 3.0m)
    for b in buildings[:50]:
        assert b["height_m"] >= 3.0
        assert b["area_m2"] >= 10.0
