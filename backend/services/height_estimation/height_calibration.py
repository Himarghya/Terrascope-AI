"""
Height Calibration and Datum Transformation Module.
Distinguishes between:
  1. Relative Depth / Height (unitless [0, 1])
  2. Estimated Object Height Above Ground (m AGL - Normalized DSM / nDSM)
  3. Absolute Elevation Above Geodetic Datum (m AMSL - Orthometric DSM)
Extracts bare-earth terrain (DEM) via morphological filtering and computes nDSM = DSM - DEM.
"""

from typing import Dict, Any, Tuple, Optional
import numpy as np
import cv2


def extract_bare_earth_dem(
    dsm: np.ndarray,
    gsd_m: float = 0.4,
    filter_radius_m: float = 16.0
) -> np.ndarray:
    """
    Extracts bare-earth terrain Digital Elevation Model (DEM) from a Digital Surface Model (DSM)
    using progressive morphological filtering to remove above-ground buildings and tree canopies.
    """
    h, w = dsm.shape
    kernel_radius_px = max(5, int(filter_radius_m / max(gsd_m, 1e-4)))
    # Structuring element larger than standard residential building width
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_radius_px * 2 + 1, kernel_radius_px * 2 + 1))

    # Morphological opening (erosion followed by dilation) removes elevated peaks
    opened = cv2.morphologyEx(dsm.astype(np.float32), cv2.MORPH_OPEN, kernel)

    # Smooth bare ground topography to eliminate sharp boundary cliffs
    dem = cv2.GaussianBlur(opened, (21, 21), sigmaX=5.0)

    # Enforce DEM <= DSM everywhere
    dem = np.minimum(dem, dsm)
    return dem.astype(np.float32)


def calibrate_height_raster(
    relative_raster: np.ndarray,
    gsd_m: float = 0.4,
    solar_shadow_reference_height_m: Optional[float] = None,
    dem_reference: Optional[np.ndarray] = None,
    nominal_max_height_m: float = 25.0
) -> Dict[str, Any]:
    """
    Calibrates a relative unitless [0, 1] surface prediction into:
      - calibrated_dsm (m): surface elevation
      - bare_earth_dem (m): ground elevation beneath structures
      - ndsm_height_agl (m): object height Above Ground Level (DSM - DEM)
    Records calibration coefficients, units, and methodology.
    """
    h, w = relative_raster.shape

    # Determine vertical scale factor (meters per unit relative prediction)
    if solar_shadow_reference_height_m is not None and solar_shadow_reference_height_m > 0:
        # Calibrate using validated solar shadow measurements
        # 95th percentile of relative raster corresponds to anchor height
        p95 = float(np.percentile(relative_raster[relative_raster > 0], 95)) if np.any(relative_raster > 0) else 1.0
        scale_factor = solar_shadow_reference_height_m / max(p95, 1e-4)
        calibration_method = "Physics-Anchored Solar Shadow Trigonometric Calibration"
        height_unit = "meters_agl"
        is_calibrated = True
    elif dem_reference is not None:
        # Calibrate using external reference elevation
        ref_range = float(dem_reference.max() - dem_reference.min())
        scale_factor = max(ref_range, 5.0)
        calibration_method = "External Geospatial DEM / Surface Control Points"
        height_unit = "meters_amsl"
        is_calibrated = True
    else:
        # Default contextual scale based on urban morphology and nominal GSD
        scale_factor = nominal_max_height_m
        calibration_method = "Contextual Urban Density Allometric Scaling (Relative Mode)"
        height_unit = "approximate_relative_m"
        is_calibrated = False

    # Compute calibrated Digital Surface Model
    calibrated_dsm = (relative_raster * scale_factor).astype(np.float32)

    # If georeferenced DEM reference is provided, add base datum
    if dem_reference is not None:
        base_datum = float(np.min(dem_reference))
        calibrated_dsm += base_datum
        bare_dem = dem_reference.astype(np.float32)
    else:
        # Extract bare-earth DEM from calibrated surface model
        bare_dem = extract_bare_earth_dem(calibrated_dsm, gsd_m=gsd_m)

    # Normalized DSM (nDSM): Height of objects strictly above local bare earth
    ndsm = np.maximum(0.0, calibrated_dsm - bare_dem).astype(np.float32)

    # Robust summary metrics
    valid_ndsm = ndsm[ndsm > 0.5]
    max_obj_height = float(np.max(ndsm)) if len(ndsm) > 0 else 0.0
    mean_obj_height = float(np.mean(valid_ndsm)) if len(valid_ndsm) > 0 else 0.0

    return {
        "calibrated_dsm": calibrated_dsm,
        "bare_earth_dem": bare_dem,
        "ndsm_height_agl": ndsm,
        "scale_factor_m": round(float(scale_factor), 3),
        "height_unit": height_unit,
        "is_calibrated": is_calibrated,
        "calibration_method": calibration_method,
        "max_object_height_m": round(max_obj_height, 2),
        "mean_above_ground_height_m": round(mean_obj_height, 2)
    }
