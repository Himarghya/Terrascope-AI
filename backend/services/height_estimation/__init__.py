"""
Single-Image Height Estimation (SIHE) Service Package.
Provides unified end-to-end interface for overhead remote-sensing height estimation,
calibration, uncertainty field computation, and building/vegetation height fusion.
"""

import os
from typing import Dict, Any, List, Optional
import numpy as np
import tifffile

from .model_adapter import get_height_estimation_model, HeightFormerAdapter
from .preprocessing import normalize_input_image
from .height_calibration import calibrate_height_raster, extract_bare_earth_dem
from .uncertainty import compute_dense_uncertainty_field
from .postprocessing import (
    aggregate_building_heights,
    aggregate_vegetation_heights,
    generate_colorized_heightmap
)
from .validation import (
    calculate_shadow_trigonometric_height,
    compute_accuracy_metrics,
    select_best_height_estimate
)


class SingleImageHeightEstimator:
    """
    Production SIHE Service orchestrating deep neural inference, physical calibration,
    uncertainty mapping, and object height extraction.
    """
    def __init__(self, device: Optional[str] = None):
        self.model = get_height_estimation_model(device=device)

    def run_sihe_pipeline(
        self,
        rgb_img: np.ndarray,
        gsd_m: float = 0.4,
        solar_azimuth: float = 135.0,
        solar_elevation: float = 45.0,
        buildings: Optional[List[Dict[str, Any]]] = None,
        trees: Optional[List[Dict[str, Any]]] = None,
        shadow_mask: Optional[np.ndarray] = None,
        output_dir: Optional[str] = None,
        job_id: str = "sihe_default"
    ) -> Dict[str, Any]:
        """
        Executes complete SIHE pipeline.
        Returns dense height rasters (relative, DSM, DEM, nDSM), uncertainty fields,
        colorized visualizations, and enriched building/tree inventory.
        """
        h, w = rgb_img.shape[:2]

        # 1. Neural model inference (HeightFormer multi-scale tiling)
        raw_pred = self.model.predict(rgb_img, gsd_m=gsd_m)
        relative_raster = raw_pred["predicted_raster"]
        validity_mask = raw_pred["validity_mask"]

        # 2. Physics-based shadow height calibration anchor
        shadow_anchor_h = None
        shadow_records = []
        if buildings and shadow_mask is not None:
            for b in buildings[:5]:
                contour = np.array(b["polygon_px"], dtype=np.int32)
                sh_res = calculate_shadow_trigonometric_height(
                    contour, shadow_mask, solar_azimuth, solar_elevation, gsd_m
                )
                if sh_res["is_valid"] and sh_res["height_m"] is not None:
                    shadow_records.append(sh_res)
                    if shadow_anchor_h is None or sh_res["height_m"] > shadow_anchor_h:
                        shadow_anchor_h = sh_res["height_m"]

        # 3. Height calibration: relative [0, 1] -> DSM (m) and nDSM (m AGL)
        calib_res = calibrate_height_raster(
            relative_raster,
            gsd_m=gsd_m,
            solar_shadow_reference_height_m=shadow_anchor_h,
            nominal_max_height_m=28.0
        )
        dsm = calib_res["calibrated_dsm"]
        dem = calib_res["bare_earth_dem"]
        ndsm = calib_res["ndsm_height_agl"]

        # 4. Dense uncertainty & confidence computation
        uncertainty_field, confidence_field, uncert_stats = compute_dense_uncertainty_field(
            ndsm, rgb_img, gsd_m=gsd_m
        )

        # 5. Extract building heights & roof slope planarity
        enhanced_buildings = []
        if buildings:
            enhanced_buildings = aggregate_building_heights(buildings, ndsm, dsm, dem, gsd_m=gsd_m)

        # 6. Extract individual tree crown canopy heights
        enhanced_trees = []
        if trees:
            enhanced_trees = aggregate_vegetation_heights(trees, ndsm, dem, gsd_m=gsd_m)

        # 7. Generate visualization artifacts
        vis_url = None
        ndsm_raw_path = None
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            vis_filename = f"sihe_heightmap_{job_id}.png"
            vis_path = os.path.join(output_dir, vis_filename)
            generate_colorized_heightmap(ndsm, vis_path, units=calib_res["height_unit"])
            vis_url = f"/exports/{vis_filename}"

            # Save float32 nDSM raster as GeoTIFF / TIFF
            tif_filename = f"sihe_ndsm_{job_id}.tif"
            tif_path = os.path.join(output_dir, tif_filename)
            tifffile.imwrite(tif_path, ndsm.astype(np.float32))
            ndsm_raw_path = f"/exports/{tif_filename}"

        return {
            "relative_raster": relative_raster,
            "dsm": dsm,
            "dem": dem,
            "ndsm": ndsm,
            "uncertainty_field": uncertainty_field,
            "confidence_field": confidence_field,
            "calibration": {
                "height_unit": calib_res["height_unit"],
                "is_calibrated": calib_res["is_calibrated"],
                "calibration_method": calib_res["calibration_method"],
                "scale_factor_m": calib_res["scale_factor_m"],
                "max_object_height_m": calib_res["max_object_height_m"],
                "mean_above_ground_height_m": calib_res["mean_above_ground_height_m"],
                "shadow_anchor_used_m": shadow_anchor_h
            },
            "uncertainty_metrics": uncert_stats,
            "visualization_url": vis_url,
            "ndsm_raster_url": ndsm_raw_path,
            "buildings": enhanced_buildings,
            "trees": enhanced_trees,
            "model_metadata": {
                "model_name": raw_pred["model_name"],
                "device": raw_pred["device"],
                "dimensions": raw_pred["dimensions"],
                "gsd_m": gsd_m
            }
        }
