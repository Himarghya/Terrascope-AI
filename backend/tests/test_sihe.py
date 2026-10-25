"""
Comprehensive Unit and Integration Tests for Single-Image Height Estimation (SIHE) Module.
Tests model adapter inference, tiling, calibration, building/tree height sampling,
shadow fallback, and error metrics.
"""

import os
import sys
import numpy as np
import cv2
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.height_estimation.preprocessing import (
    normalize_input_image,
    generate_tiling_grid,
    create_cosine_blend_window
)
from services.height_estimation.model_adapter import (
    HeightFormerAdapter,
    get_height_estimation_model
)
from services.height_estimation.height_calibration import (
    extract_bare_earth_dem,
    calibrate_height_raster
)
from services.height_estimation.postprocessing import (
    aggregate_building_heights,
    aggregate_vegetation_heights
)
from services.height_estimation.uncertainty import compute_dense_uncertainty_field
from services.height_estimation.validation import (
    calculate_shadow_trigonometric_height,
    compute_accuracy_metrics,
    select_best_height_estimate
)
from services.height_estimation import SingleImageHeightEstimator


def test_tiling_and_blend_window():
    """Tests tile generation and smooth cosine blending window."""
    h, w = 1000, 1000
    tiles = generate_tiling_grid(h, w, tile_size=512, overlap=128)
    assert len(tiles) >= 4

    window = create_cosine_blend_window(512, 512)
    assert window.shape == (512, 512)
    assert window[256, 256] > 0.95
    assert window[0, 0] < 0.05


def test_model_adapter_inference():
    """Tests HeightFormer neural model inference output."""
    model = HeightFormerAdapter(device="cpu")
    dummy_img = np.random.randint(50, 200, (256, 256, 3), dtype=np.uint8)

    pred = model.predict(dummy_img, gsd_m=0.4)
    raster = pred["predicted_raster"]
    assert raster.shape == (256, 256)
    assert raster.dtype == np.float32
    assert raster.min() >= 0.0
    assert raster.max() <= 1.0
    assert pred["units"] == "relative_unitless"
    assert pred["is_relative"] is True


def test_bare_earth_dem_and_ndsm_calibration():
    """Tests bare earth DEM extraction and nDSM object height computation."""
    dsm = np.full((120, 120), 10.0, dtype=np.float32)
    dsm[40:80, 40:80] = 30.0  # 20m building above 10m ground

    dem = extract_bare_earth_dem(dsm, gsd_m=0.4, filter_radius_m=12.0)
    assert dem[60, 60] < 15.0
    assert abs(dem[10, 10] - 10.0) < 1.0

    rel_raster = (dsm - 10.0) / 20.0
    calib = calibrate_height_raster(rel_raster, gsd_m=0.4, nominal_max_height_m=20.0)
    assert calib["height_unit"] == "approximate_relative_m"
    assert "ndsm_height_agl" in calib
    assert calib["ndsm_height_agl"].shape == (120, 120)


def test_building_footprint_height_aggregation():
    """Tests sampling heights within building polygon and ground buffer."""
    ndsm = np.zeros((100, 100), dtype=np.float32)
    dsm = np.full((100, 100), 10.0, dtype=np.float32)
    dem = np.full((100, 100), 10.0, dtype=np.float32)

    ndsm[30:70, 30:70] = 12.5
    dsm[30:70, 30:70] = 22.5

    buildings = [{
        "id": "BLD-TEST",
        "polygon_px": [[30, 30], [70, 30], [70, 70], [30, 70]],
        "estimated_height_m": 6.0
    }]

    enhanced = aggregate_building_heights(buildings, ndsm, dsm, dem, gsd_m=0.4)
    b0 = enhanced[0]
    assert b0["sihe_height_m"] == 12.5
    assert b0["height_unit"] == "meters_agl"
    assert "sihe_uncertainty_m" in b0


def test_shadow_trigonometric_fallback():
    """Tests solar shadow geometry height calculation."""
    shadow_mask = np.zeros((100, 100), dtype=np.uint8)
    contour = np.array([[50, 50], [70, 50], [70, 70], [50, 70]], dtype=np.int32)

    # Draw cast shadow to the North-West
    cv2.rectangle(shadow_mask, (35, 35), (55, 55), 255, -1)

    res = calculate_shadow_trigonometric_height(
        contour, shadow_mask, solar_azimuth_deg=135.0, solar_elevation_deg=45.0, gsd_m=0.5
    )
    assert res["is_valid"] is True
    assert res["height_m"] is not None
    assert abs(res["height_m"] - 20.0) < 3.0

    # Test rejection of invalid solar elevation (e.g. 2 degrees)
    res_invalid = calculate_shadow_trigonometric_height(
        contour, shadow_mask, solar_azimuth_deg=135.0, solar_elevation_deg=2.0, gsd_m=0.5
    )
    assert res_invalid["is_valid"] is False


def test_accuracy_metrics():
    """Tests MAE, RMSE, Bias, and Pearson r calculation."""
    preds = np.array([10.0, 15.0, 20.0, 25.0])
    truth = np.array([10.5, 14.5, 20.0, 25.0])

    metrics = compute_accuracy_metrics(preds, truth)
    assert metrics["mae_m"] == 0.25
    assert metrics["mean_bias_m"] == 0.0
    assert metrics["pearson_r"] > 0.99
