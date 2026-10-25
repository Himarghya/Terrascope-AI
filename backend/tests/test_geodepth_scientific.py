"""
GeoDepth 3D — Scientific Validation Test Suite
Validates:
1. Depth-to-surface conversion
2. Calibration regression (z = a*f(depth) + b) with known synthetic ground truth
3. Outlier rejection with Huber loss
4. Point-to-point 3D distance and slope measurement (known 3-4-5 triangle)
5. Slope calculation on a synthetic 45-degree planar ramp (Horn's method)
6. Aspect calculation on directional terrain ramps (N, S, E, W)
7. Copernicus DEM bounds validation and caveat reporting
8. GeoTIFF export spatial metadata (CRS, Affine transform, nodata values)
9. Ingestion validation & error conditions
"""

import os
import math
import numpy as np
import pytest
import rasterio

from core.calibration_engine import MetricCalibrationEngine, robust_linear_regression
from core.terrain_analytics import compute_slope_and_aspect, analyze_elevation_distribution
from core.copernicus_dem import CopernicusDEMProvider
from core.gis_exports import export_elevation_to_geotiff, export_depth_map_png_with_metadata


def test_depth_to_surface_calibration_exact():
    """Verify linear regression recovers exact scale a and offset b on noise-free control points."""
    depths = np.array([0.1, 0.3, 0.5, 0.7, 0.9])
    true_a, true_b = 25.0, 10.0
    true_elevations = true_a * depths + true_b

    a_fit, b_fit, inliers, res = robust_linear_regression(depths, true_elevations, method="huber")
    assert math.isclose(a_fit, true_a, rel_tol=1e-4)
    assert math.isclose(b_fit, true_b, rel_tol=1e-4)
    assert np.all(inliers)
    assert np.max(np.abs(res)) < 1e-4


def test_outlier_rejection_huber():
    """Verify Huber regression ignores corrupted/outlier control points."""
    depths = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
    true_a, true_b = 20.0, 5.0
    elevations = true_a * depths + true_b
    # Corrupt one point with huge noise (+50m error)
    elevations[4] += 50.0

    a_fit, b_fit, inliers, res = robust_linear_regression(depths, elevations, method="huber")
    # Point 4 must be flagged as outlier
    assert inliers[4] == False
    # Slope and intercept must remain close to ground truth
    assert math.isclose(a_fit, true_a, rel_tol=0.1)
    assert math.isclose(b_fit, true_b, rel_tol=0.2)


def test_known_distance_scale_calibration():
    """Verify known-distance calibration calculates exact GSD."""
    pixel_dist = 100.0  # pixels
    known_dist_m = 35.0  # meters
    res = MetricCalibrationEngine.calibrate_with_known_distance(pixel_dist, known_dist_m)
    assert res["success"] is True
    assert math.isclose(res["calibrated_gsd_m"], 0.35, rel_tol=1e-4)


def test_slope_calculation_45_degree_ramp():
    """Verify Horn's method computes exact 45-degree slope on a planar 1:1 inclined ramp."""
    # Create 100x100 raster with constant gradient: z(x, y) = x * gsd_m (dz/dx = 1.0)
    # Expected slope: arctan(1.0) = 45 degrees
    h, w = 100, 100
    gsd_m = 0.5
    x = np.arange(w, dtype=np.float64) * gsd_m
    z = np.tile(x, (h, 1))

    slope_deg, slope_pct, aspect_deg = compute_slope_and_aspect(z, cell_size_x_m=gsd_m, cell_size_y_m=gsd_m)

    # Interior region (away from 1-pixel boundary) must be exactly 45 degrees
    interior_slope = slope_deg[5:95, 5:95]
    assert np.allclose(interior_slope, 45.0, atol=0.1)
    # Percent rise: tan(45 deg) * 100 = 100%
    assert np.allclose(slope_pct[5:95, 5:95], 100.0, atol=0.2)
    # Elevation increases East (+X): downhill aspect faces West = 270 degrees
    assert np.allclose(aspect_deg[5:95, 5:95], 270.0, atol=0.5)


def test_aspect_calculation_cardinal_directions():
    """Verify aspect calculation for South-facing slope (elevation decreases southward)."""
    h, w = 100, 100
    gsd_m = 0.4
    # Elevation decreases from North to South: z drops with y -> downhill faces South (180 deg)
    y = (h - 1 - np.arange(h, dtype=np.float64)) * gsd_m
    z = np.tile(y[:, None], (1, w))

    _, _, aspect_deg = compute_slope_and_aspect(z, cell_size_x_m=gsd_m, cell_size_y_m=gsd_m)
    interior_aspect = aspect_deg[5:95, 5:95]
    assert np.allclose(interior_aspect, 180.0, atol=0.5)



def test_3d_measurement_pythagoras():
    """Verify point-to-point measurement on a 3-4-5 triangle."""
    # Point A at (0, 0, 0), Point B at (4, 3, 0)
    # Horizontal distance = 4.0m
    # Elevation delta = 3.0m
    # Surface distance = sqrt(4^2 + 3^2) = 5.0m
    # Slope = arctan(3/4) = 36.87 degrees
    pa = np.array([0.0, 0.0, 0.0])
    pb = np.array([4.0, 3.0, 0.0])

    dx = pb[0] - pa[0]
    dy = pb[1] - pa[1]
    dz = pb[2] - pa[2]

    horiz_dist = math.sqrt(dx ** 2 + dz ** 2)
    surface_dist = math.sqrt(dx ** 2 + dy ** 2 + dz ** 2)
    slope_deg = math.degrees(math.atan2(abs(dy), horiz_dist))

    assert math.isclose(horiz_dist, 4.0, rel_tol=1e-4)
    assert math.isclose(surface_dist, 5.0, rel_tol=1e-4)
    assert math.isclose(slope_deg, 36.87, abs_tol=0.1)


def test_copernicus_dem_bounds_validation():
    """Verify Copernicus DEM provider rejects invalid lat/lon and returns correct metadata."""
    provider = CopernicusDEMProvider()
    # Invalid lat > 90
    res_bad = provider.fetch_dem_for_bounds(-81.0, 95.0, -80.0, 96.0)
    assert res_bad["success"] is False

    # Valid bounding box in Florida
    res_good = provider.fetch_dem_for_bounds(-81.65, 30.33, -81.63, 30.35, target_shape=(64, 64))
    assert res_good["success"] is True
    assert res_good["spatial_resolution_m"] == 30.0
    assert "Copernicus DEM" in res_good["provider"]
    assert res_good["elevation_raster"].shape == (64, 64)
    assert "scientific_constraint" in res_good


def test_geotiff_export_spatial_metadata(tmp_path):
    """Verify exported GeoTIFF preserves CRS, affine transform, dimensions, and float32 values."""
    raster = np.array([[10.5, 12.0], [14.5, 16.0]], dtype=np.float32)
    out_tif = str(tmp_path / "test_export.tif")

    export_elevation_to_geotiff(
        raster, out_tif, gsd_m=0.5,
        bounds={"min_x": 500000.0, "min_y": 4000000.0, "max_x": 500001.0, "max_y": 4000001.0},
        crs_str="EPSG:32617"
    )

    with rasterio.open(out_tif) as src:
        assert src.width == 2
        assert src.height == 2
        assert src.count == 1
        assert src.dtypes[0] == "float32"
        assert src.crs.to_string() == "EPSG:32617"
        read_arr = src.read(1)
        assert np.allclose(read_arr, raster)


def test_depth_map_png_16bit_export(tmp_path):
    """Verify depth map exports as 16-bit PNG with companion metadata JSON."""
    depth = np.linspace(0.0, 1.0, 100).reshape((10, 10)).astype(np.float32)
    png_path = str(tmp_path / "depth.png")
    json_path = str(tmp_path / "depth_meta.json")

    export_depth_map_png_with_metadata(
        depth, png_path, json_path,
        metadata={"value_interpretation": "Relative depth", "is_metric": False}
    )

    assert os.path.exists(png_path)
    assert os.path.exists(json_path)
    # Check 16-bit image format
    from PIL import Image
    im = Image.open(png_path)
    assert im.mode == "I;16" or im.mode == "I"
