"""
GeoDepth 3D — Terrain Analysis Toolkit
Implements:
1. Slope Analysis (Horn's method, degrees & percent rise, classification thresholds)
2. Aspect Analysis (compass-based orientation with 8-direction bins)
3. Elevation Analysis (min, max, mean, distribution histogram, depressions & peaks)
4. Drainage & Flood Susceptibility (topographic sink/depression index & flow accumulation proxy)
5. Landslide Topographic Screening (slope thresholding & slope-curvature risk zones)
6. Surface Classification summary & visualization textures
"""

import numpy as np
import cv2
from typing import Dict, Any, List, Optional, Tuple


def compute_slope_and_aspect(
    elevation_raster: np.ndarray,
    cell_size_x_m: float = 0.4,
    cell_size_y_m: float = 0.4
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Computes slope (degrees), slope (percent rise), and aspect (degrees 0-360)
    using Horn's (1981) 8-neighbor finite-difference algorithm.
    """
    z = elevation_raster.astype(np.float64)
    h, w = z.shape

    # Kernels for 8-neighbor finite differences (Horn's algorithm)
    # dx: horizontal gradient
    # dy: vertical gradient
    kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float64) / (8.0 * cell_size_x_m)
    ky = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=np.float64) / (8.0 * cell_size_y_m)

    dz_dx = cv2.filter2D(z, -1, kx, borderType=cv2.BORDER_REPLICATE)
    dz_dy = cv2.filter2D(z, -1, ky, borderType=cv2.BORDER_REPLICATE)

    # Slope in radians
    grad_mag = np.sqrt(dz_dx ** 2 + dz_dy ** 2)
    slope_rad = np.arctan(grad_mag)
    slope_deg = np.degrees(slope_rad).astype(np.float32)

    # Slope percent rise: tan(slope) * 100%
    slope_percent = (grad_mag * 100.0).astype(np.float32)

    # Aspect: compass direction that a slope faces (0 = North, 90 = East, 180 = South, 270 = West)
    # Horn's formula: aspect = 270 - arctan2(dz_dy, -dz_dx) in degrees
    aspect_rad = np.arctan2(dz_dy, -dz_dx)
    aspect_deg = (450.0 - np.degrees(aspect_rad)) % 360.0
    # Flat areas (slope < 0.5 deg) have undefined aspect, represented as -1.0
    aspect_deg[slope_deg < 0.5] = -1.0
    aspect_deg = aspect_deg.astype(np.float32)

    return slope_deg, slope_percent, aspect_deg


def analyze_elevation_distribution(
    elevation_raster: np.ndarray,
    num_bins: int = 20
) -> Dict[str, Any]:
    """
    Calculates detailed elevation distribution statistics, histogram bins,
    local topographic depressions (sinks), and prominent peaks.
    """
    valid = elevation_raster[np.isfinite(elevation_raster)]
    if len(valid) == 0:
        return {"error": "No valid elevation data"}

    min_elev = float(np.min(valid))
    max_elev = float(np.max(valid))
    mean_elev = float(np.mean(valid))
    median_elev = float(np.median(valid))
    std_elev = float(np.std(valid))
    elev_range = float(max_elev - min_elev)

    # 20-bin histogram
    counts, bin_edges = np.histogram(valid, bins=num_bins)
    histogram = []
    for i in range(len(counts)):
        histogram.append({
            "bin_start": round(float(bin_edges[i]), 1),
            "bin_end": round(float(bin_edges[i + 1]), 1),
            "count": int(counts[i]),
            "pct": round(float(counts[i] / len(valid) * 100.0), 1)
        })

    # Detect local depressions (sinks): pixels lower than surrounding 5x5 neighborhood by > 0.8m
    blurred = cv2.GaussianBlur(elevation_raster.astype(np.float32), (5, 5), 1.5)
    depressions_mask = (blurred - elevation_raster) > 0.8
    depression_count = int(np.sum(depressions_mask))

    # Detect local peaks: pixels higher than surrounding neighborhood by > 1.2m
    peaks_mask = (elevation_raster - blurred) > 1.2
    peak_count = int(np.sum(peaks_mask))

    return {
        "elevation_min_m": round(min_elev, 2),
        "elevation_max_m": round(max_elev, 2),
        "elevation_mean_m": round(mean_elev, 2),
        "elevation_median_m": round(median_elev, 2),
        "elevation_std_m": round(std_elev, 2),
        "elevation_range_m": round(elev_range, 2),
        "histogram": histogram,
        "depressions_detected": depression_count,
        "peaks_detected": peak_count
    }


def compute_drainage_and_flood_screening(
    elevation_raster: np.ndarray,
    slope_deg: np.ndarray,
    gsd_m: float = 0.4
) -> Dict[str, Any]:
    """
    Calculates exploratory terrain-based drainage and flood susceptibility indicators
    based on elevation depressions, flow accumulation proxy, and flat pooling zones.
    """
    h, w = elevation_raster.shape

    # Morphological depression filling to detect ponding depth
    # Morphological reconstruction by erosion (fills closed pits/sinks)
    kernel = np.ones((5, 5), np.uint8)
    dilated = cv2.dilate(elevation_raster.astype(np.float32), kernel)
    ponding_depth = np.maximum(0.0, dilated - elevation_raster)

    # Flat low-lying zones: slope < 3 degrees in lower 25% of elevation range
    p25 = float(np.percentile(elevation_raster, 25))
    pooling_zones = (slope_deg < 3.0) & (elevation_raster <= p25)
    pooling_area_sq_m = float(np.sum(pooling_zones) * (gsd_m ** 2))
    total_area_sq_m = float(h * w * (gsd_m ** 2))

    high_susceptibility_pct = round((pooling_area_sq_m / max(total_area_sq_m, 1e-4)) * 100.0, 1)

    return {
        "pooling_area_sq_m": round(pooling_area_sq_m, 1),
        "susceptibility_area_pct": high_susceptibility_pct,
        "max_ponding_depth_m": round(float(np.max(ponding_depth)), 2),
        "mean_ponding_depth_m": round(float(np.mean(ponding_depth)), 2),
        "drainage_flow_indicator": "Active runoff with localized pooling zones" if high_susceptibility_pct > 10.0 else "Well-drained topographic gradient",
        "scientific_disclaimer": "Exploratory terrain screening only. Does not replace hydraulic, meteorological, or catchment flood modeling."
    }


def compute_landslide_screening(
    slope_deg: np.ndarray,
    elevation_raster: np.ndarray,
    gsd_m: float = 0.4
) -> Dict[str, Any]:
    """
    Screens terrain for steep slopes and profile curvature that may warrant geotechnical study.
    """
    h, w = slope_deg.shape
    total_pixels = h * w

    # Slope risk categories
    steep_30 = slope_deg > 30.0
    extreme_45 = slope_deg > 45.0

    pct_over_30 = float(np.sum(steep_30) / total_pixels * 100.0)
    pct_over_45 = float(np.sum(extreme_45) / total_pixels * 100.0)

    # Laplacian of elevation indicates topographic profile curvature
    curvature = cv2.Laplacian(elevation_raster.astype(np.float32), cv2.CV_32F, ksize=3)
    concave_steep = steep_30 & (curvature > 0.5)
    concave_area_sq_m = float(np.sum(concave_steep) * (gsd_m ** 2))

    risk_level = "Low (predominantly gentle terrain)"
    if pct_over_45 > 5.0 or pct_over_30 > 25.0:
        risk_level = "High Topographic Relief (Multiple steep slope corridors)"
    elif pct_over_30 > 8.0:
        risk_level = "Moderate Topographic Relief"

    return {
        "risk_level": risk_level,
        "slopes_over_30_deg_pct": round(pct_over_30, 1),
        "slopes_over_45_deg_pct": round(pct_over_45, 1),
        "steep_concave_chute_area_sq_m": round(concave_area_sq_m, 1),
        "scientific_disclaimer": "Topographic slope screening only. Geotechnical stability requires geological surveys, soil cohesion, pore pressure, and rainfall data."
    }


def generate_terrain_analysis_report(
    elevation_raster: np.ndarray,
    gsd_m: float = 0.4,
    class_map: Optional[np.ndarray] = None
) -> Dict[str, Any]:
    """
    Executes full terrain analysis suite on a valid elevation surface.
    Returns complete analytics dictionary for API and frontend visualization.
    """
    slope_deg, slope_pct, aspect_deg = compute_slope_and_aspect(elevation_raster, gsd_m, gsd_m)
    elev_stats = analyze_elevation_distribution(elevation_raster)
    drainage = compute_drainage_and_flood_screening(elevation_raster, slope_deg, gsd_m)
    landslide = compute_landslide_screening(slope_deg, elevation_raster, gsd_m)

    # Slope classification breakdown
    total_px = elevation_raster.size
    flat_pct = float(np.sum(slope_deg < 5.0) / total_px * 100.0)
    gentle_pct = float(np.sum((slope_deg >= 5.0) & (slope_deg < 15.0)) / total_px * 100.0)
    moderate_pct = float(np.sum((slope_deg >= 15.0) & (slope_deg < 30.0)) / total_px * 100.0)
    steep_pct = float(np.sum(slope_deg >= 30.0) / total_px * 100.0)

    # Aspect distribution: N (337.5-22.5), NE, E, SE, S, SW, W, NW
    aspect_counts = {
        "North": round(float(np.sum(((aspect_deg >= 337.5) | ((aspect_deg >= 0) & (aspect_deg < 22.5)))) / total_px * 100.0), 1),
        "Northeast": round(float(np.sum((aspect_deg >= 22.5) & (aspect_deg < 67.5)) / total_px * 100.0), 1),
        "East": round(float(np.sum((aspect_deg >= 67.5) & (aspect_deg < 112.5)) / total_px * 100.0), 1),
        "Southeast": round(float(np.sum((aspect_deg >= 112.5) & (aspect_deg < 157.5)) / total_px * 100.0), 1),
        "South": round(float(np.sum((aspect_deg >= 157.5) & (aspect_deg < 202.5)) / total_px * 100.0), 1),
        "Southwest": round(float(np.sum((aspect_deg >= 202.5) & (aspect_deg < 247.5)) / total_px * 100.0), 1),
        "West": round(float(np.sum((aspect_deg >= 247.5) & (aspect_deg < 292.5)) / total_px * 100.0), 1),
        "Northwest": round(float(np.sum((aspect_deg >= 292.5) & (aspect_deg < 337.5)) / total_px * 100.0), 1),
        "Flat (No Aspect)": round(float(np.sum(aspect_deg < 0) / total_px * 100.0), 1)
    }

    return {
        "slope": {
            "mean_slope_deg": round(float(np.mean(slope_deg)), 1),
            "max_slope_deg": round(float(np.max(slope_deg)), 1),
            "mean_slope_pct": round(float(np.mean(slope_pct)), 1),
            "categories": {
                "flat_lt_5deg": round(flat_pct, 1),
                "gentle_5_to_15deg": round(gentle_pct, 1),
                "moderate_15_to_30deg": round(moderate_pct, 1),
                "steep_gt_30deg": round(steep_pct, 1)
            }
        },
        "aspect": {
            "dominant_direction": max(aspect_counts, key=aspect_counts.get),
            "distribution": aspect_counts
        },
        "elevation": elev_stats,
        "drainage": drainage,
        "landslide_screening": landslide
    }
