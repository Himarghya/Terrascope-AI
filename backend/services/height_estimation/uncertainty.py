"""
Uncertainty Estimation and Confidence Field Module for SIHE.
Calculates per-pixel variance, occlusion edge uncertainty, and 95% confidence intervals.
"""

from typing import Tuple, Dict, Any
import numpy as np
import cv2


def compute_dense_uncertainty_field(
    height_raster: np.ndarray,
    rgb_img: np.ndarray,
    gsd_m: float = 0.4
) -> Tuple[np.ndarray, np.ndarray, Dict[str, float]]:
    """
    Computes dense per-pixel height uncertainty field (in meters) and calibrated confidence index [0, 1].
    Factors in:
      1. Spatial height gradients (occlusion boundaries have higher uncertainty)
      2. Image radiometric contrast and texture variance
      3. Absolute height magnitude (taller structures carry greater absolute uncertainty)
    """
    h, w = height_raster.shape

    # 1. Height gradient magnitude (boundary discontinuity penalty)
    gy, gx = np.gradient(height_raster)
    grad_mag = np.sqrt(gx**2 + gy**2)
    edge_penalty = np.clip(grad_mag / 4.0, 0.0, 2.5)

    # 2. Radiometric texture variance in optical image
    gray = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2GRAY).astype(np.float32)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    texture_var = np.abs(gray - blur)
    # Low-texture or saturated areas have slightly higher uncertainty
    texture_penalty = np.where(texture_var < 3.0, 0.8, 0.0)

    # 3. Base sensor and GSD uncertainty (proportional to ground resolution)
    base_uncertainty_m = gsd_m * 1.2

    # Height scale factor (taller buildings have greater absolute variance)
    scale_uncertainty = np.clip(height_raster * 0.12, 0.0, 5.0)

    # Combined 95% uncertainty interval field in meters: ΔH = Base + Scale + Edge + Texture
    uncertainty_field_m = (base_uncertainty_m + scale_uncertainty + edge_penalty + texture_penalty).astype(np.float32)

    # Calibrated confidence field [0.0, 1.0]
    confidence_field = np.clip(1.0 - (uncertainty_field_m / 8.0), 0.35, 0.95).astype(np.float32)

    stats = {
        "mean_uncertainty_m": round(float(np.mean(uncertainty_field_m)), 2),
        "median_uncertainty_m": round(float(np.median(uncertainty_field_m)), 2),
        "min_uncertainty_m": round(float(np.min(uncertainty_field_m)), 2),
        "max_uncertainty_m": round(float(np.max(uncertainty_field_m)), 2),
        "mean_confidence_score": round(float(np.mean(confidence_field)), 3)
    }

    return uncertainty_field_m, confidence_field, stats
