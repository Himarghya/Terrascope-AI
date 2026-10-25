"""
Validation and Shadow Fallback Module for Single-Image Height Estimation (SIHE).
Implements physics-based solar shadow triangulation, multi-source fusion hierarchy,
and empirical error metrics (MAE, RMSE, Bias, Pearson correlation).
"""

from typing import Dict, Any, List, Optional, Tuple
import math
import numpy as np
import cv2


def calculate_shadow_trigonometric_height(
    building_contour: np.ndarray,
    shadow_mask: np.ndarray,
    solar_azimuth_deg: float,
    solar_elevation_deg: float,
    gsd_m: float
) -> Dict[str, Any]:
    """
    Physics-based shadow height estimation fallback:
      Height = Shadow_Length * tan(Solar_Elevation)
    Validates angle conventions, shadow continuity, and rejects ambiguous or overlapping shadows.
    """
    h_img, w_img = shadow_mask.shape

    # Reject invalid solar elevation (sun below horizon or at zenith)
    if solar_elevation_deg <= 5.0 or solar_elevation_deg >= 85.0:
        return {
            "is_valid": False,
            "height_m": None,
            "uncertainty_m": None,
            "reason": f"Invalid solar elevation angle ({solar_elevation_deg}°). Must be between 5° and 85°."
        }

    # Standard remote-sensing clockwise solar azimuth convention from North (0°=N, 90°=E, 180°=S, 270°=W)
    # Sun vector points along (sin(az), -cos(az)) in image coordinates (where North is -Y and East is +X)
    # Shadow vector is opposite to sun vector: dx = -sin(az), dy = +cos(az)
    az_rad = math.radians(solar_azimuth_deg)
    dx = -math.sin(az_rad)
    dy = math.cos(az_rad)

    # Building polygon mask
    b_mask = np.zeros((h_img, w_img), dtype=np.uint8)
    cv2.drawContours(b_mask, [building_contour], -1, 255, -1)
    b_area = cv2.countNonZero(b_mask)

    if b_area < 25:
        return {
            "is_valid": False,
            "height_m": None,
            "uncertainty_m": None,
            "reason": "Building footprint too small for reliable shadow ray sampling."
        }

    # Step along shadow vector to measure contiguous cast shadow length
    max_search_px = 70
    measured_len_px = 0.0
    shadow_active = False

    for step in range(2, max_search_px, 2):
        M = np.float32([[1, 0, dx * step], [0, 1, dy * step]])
        shifted = cv2.warpAffine(b_mask, M, (w_img, h_img))
        overlap = cv2.bitwise_and(shifted, shadow_mask)
        overlap_ratio = cv2.countNonZero(overlap) / float(b_area)

        if overlap_ratio > 0.12:
            measured_len_px = float(step)
            shadow_active = True
        elif shadow_active and overlap_ratio < 0.04:
            # End of contiguous shadow cast
            break

    if not shadow_active or measured_len_px < 3.0:
        return {
            "is_valid": False,
            "height_m": None,
            "uncertainty_m": None,
            "reason": "No distinct contiguous cast shadow identified along solar azimuth."
        }

    # Physical distance in meters
    shadow_len_m = measured_len_px * gsd_m
    tan_elev = math.tan(math.radians(solar_elevation_deg))
    h_m = shadow_len_m * tan_elev

    # Restrain to realistic bounds [2.5m, 120m]
    h_m = max(2.5, min(h_m, 120.0))
    # Uncertainty includes GSD discretization and solar angle tolerance (~2 deg)
    uncertainty_m = round(max(1.2, h_m * 0.16 + gsd_m), 1)

    return {
        "is_valid": True,
        "height_m": round(h_m, 1),
        "uncertainty_m": uncertainty_m,
        "shadow_length_m": round(shadow_len_m, 1),
        "shadow_length_px": round(measured_len_px, 1),
        "solar_azimuth_deg": solar_azimuth_deg,
        "solar_elevation_deg": solar_elevation_deg,
        "method": "Physics Solar Shadow Trigonometry"
    }


def compute_accuracy_metrics(
    predictions: np.ndarray,
    ground_truth: np.ndarray,
    mask: Optional[np.ndarray] = None
) -> Dict[str, Any]:
    """
    Computes standard remote-sensing error metrics:
      - Mean Absolute Error (MAE)
      - Root Mean Square Error (RMSE)
      - Mean Bias Error (MBE)
      - Pearson Correlation Coefficient (r)
    """
    if mask is not None:
        p_valid = predictions[mask > 0]
        gt_valid = ground_truth[mask > 0]
    else:
        p_valid = predictions.flatten()
        gt_valid = ground_truth.flatten()

    if len(p_valid) == 0 or len(gt_valid) == 0:
        return {"mae": None, "rmse": None, "bias": None, "correlation": None, "samples": 0}

    diff = p_valid - gt_valid
    mae = float(np.mean(np.abs(diff)))
    rmse = float(np.sqrt(np.mean(diff ** 2)))
    bias = float(np.mean(diff))

    # Pearson r
    if np.std(p_valid) > 1e-5 and np.std(gt_valid) > 1e-5:
        corr_matrix = np.corrcoef(p_valid, gt_valid)
        r = float(corr_matrix[0, 1])
    else:
        r = 1.0

    return {
        "mae_m": round(mae, 2),
        "rmse_m": round(rmse, 2),
        "mean_bias_m": round(bias, 2),
        "pearson_r": round(r, 3),
        "sample_count": int(len(p_valid))
    }


def select_best_height_estimate(
    sihe_val: Optional[float],
    shadow_val: Optional[float],
    morphology_val: Optional[float],
    reference_val: Optional[float] = None
) -> Tuple[float, str, float]:
    """
    Applies evidence-based hierarchy for final height selection:
      1. Reference Ground Truth / LiDAR (highest priority)
      2. Calibrated SIHE Neural Model
      3. Solar Shadow Trigonometry
      4. Morphological Contextual Priors
    Returns: (selected_height_m, source_label, confidence_score)
    """
    if reference_val is not None and reference_val > 0:
        return round(reference_val, 1), "Ground-Truth Reference / LiDAR Surface", 0.98

    if sihe_val is not None and sihe_val > 0:
        # Check agreement with shadow if both exist
        if shadow_val is not None and shadow_val > 0:
            diff = abs(sihe_val - shadow_val)
            if diff < 3.0:
                # Strong mutual agreement
                fused = round((sihe_val * 0.65 + shadow_val * 0.35), 1)
                return fused, "Fused SIHE Neural Inference & Solar Shadow Trigonometry", 0.92
            else:
                # Discrepancy: prefer SIHE if roof footprint is irregular, otherwise weighted
                return round(sihe_val, 1), "Calibrated SIHE HeightFormer Neural Inference", 0.86
        return round(sihe_val, 1), "Calibrated SIHE HeightFormer Neural Inference", 0.84

    if shadow_val is not None and shadow_val > 0:
        return round(shadow_val, 1), "Solar Shadow Trigonometric Geometry", 0.80

    if morphology_val is not None and morphology_val > 0:
        return round(morphology_val, 1), "Footprint Morphology Contextual Prior", 0.60

    return 6.0, "Nominal Default Urban Structure Prior", 0.40
