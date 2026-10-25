"""
GeoDepth 3D — GIS Export Module
Implements:
1. Exporting Georeferenced GeoTIFF (preserving CRS, Affine transform, nodata values, elevation units)
2. Exporting Processed Depth Map (PNG 8-bit / 16-bit) with companion JSON metadata
3. Exporting Point-to-Point Measurements as CSV and GeoJSON
4. Exporting Calibration and Terrain Analysis Reports as JSON and CSV
"""

import os
import json
import csv
import numpy as np
from PIL import Image
from typing import Dict, Any, List, Optional
import rasterio
from rasterio.transform import from_bounds, from_origin

# Ensure rasterio uses its bundled proj_data rather than system PostgreSQL proj.db
try:
    proj_dir = os.path.join(os.path.dirname(rasterio.__file__), "proj_data")
    if os.path.exists(proj_dir):
        os.environ["PROJ_LIB"] = proj_dir
        os.environ["PROJ_DATA"] = proj_dir
except Exception:
    pass



def export_elevation_to_geotiff(
    elevation_raster: np.ndarray,
    output_path: str,
    gsd_m: float = 0.4,
    bounds: Optional[Dict[str, float]] = None,
    crs_str: Optional[str] = "EPSG:32617",
    nodata_val: float = -9999.0
) -> str:
    """
    Exports a 2D float32 elevation array to a valid georeferenced GeoTIFF.
    Preserves spatial coordinates, affine transform, CRS, and nodata values.
    """
    h, w = elevation_raster.shape[:2]
    raster_data = elevation_raster.astype(np.float32)

    if bounds and "min_x" in bounds:
        transform = from_bounds(
            bounds["min_x"], bounds["min_y"], bounds["max_x"], bounds["max_y"], w, h
        )
    else:
        # Default local Cartesian metric origin centered at (0, 0)
        transform = from_origin(
            - (w * gsd_m) / 2.0, (h * gsd_m) / 2.0, gsd_m, gsd_m
        )

    crs = crs_str if crs_str and "EPSG" in crs_str else "EPSG:3857"

    with rasterio.open(
        output_path,
        'w',
        driver='GTiff',
        height=h,
        width=w,
        count=1,
        dtype=rasterio.float32,
        crs=crs,
        transform=transform,
        nodata=nodata_val
    ) as dst:
        dst.write(raster_data, 1)

    return output_path


def export_depth_map_png_with_metadata(
    depth_raster: np.ndarray,
    output_png_path: str,
    output_json_path: str,
    metadata: Dict[str, Any]
) -> Tuple[str, str]:
    """
    Exports normalized depth map as an 8-bit / 16-bit PNG along with companion metadata JSON.
    Never assumes 0-1 values represent meters.
    """
    # Normalize depth map to uint16 (0 to 65535) for high photometric precision
    d = depth_raster.astype(np.float32)
    d_min, d_max = float(np.min(d)), float(np.max(d))
    denom = max(d_max - d_min, 1e-6)
    norm_16 = np.clip((d - d_min) / denom * 65535.0, 0, 65535).astype(np.uint16)

    # Save 16-bit PNG
    img_16 = Image.fromarray(norm_16)
    img_16.save(output_png_path)

    # Write companion metadata
    meta = {
        "format": "16-bit Single-Channel Depth Raster (PNG)",
        "bit_depth": 16,
        "raw_min_value": d_min,
        "raw_max_value": d_max,
        "value_interpretation": metadata.get("value_interpretation", "Relative surface depth (0 = near/high, 65535 = far/low)"),
        "is_metric": metadata.get("is_metric", False),
        "calibration_status": metadata.get("calibration_status", "Uncalibrated relative depth"),
        "gsd_m": metadata.get("gsd_m", 0.35),
        "dimensions": {
            "width": int(depth_raster.shape[1]),
            "height": int(depth_raster.shape[0])
        },
        "scientific_disclaimer": "Pixel values are normalized relative depth estimates and must not be used as absolute metric elevation without calibration."
    }

    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)

    return output_png_path, output_json_path


def export_measurements_to_csv(
    measurements: List[Dict[str, Any]],
    output_csv_path: str
) -> str:
    """
    Exports interactive point-to-point measurements to a clean CSV table.
    """
    fieldnames = [
        "measurement_id",
        "point_a_x",
        "point_a_y",
        "point_a_z",
        "point_b_x",
        "point_b_y",
        "point_b_z",
        "horizontal_distance_m",
        "surface_3d_distance_m",
        "elevation_difference_m",
        "slope_degrees",
        "reliability_status",
        "timestamp"
    ]

    with open(output_csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for m in measurements:
            writer.writerow({
                "measurement_id": m.get("id", "M-1"),
                "point_a_x": m.get("point_a", [0, 0, 0])[0],
                "point_a_y": m.get("point_a", [0, 0, 0])[1],
                "point_a_z": m.get("point_a", [0, 0, 0])[2],
                "point_b_x": m.get("point_b", [0, 0, 0])[0],
                "point_b_y": m.get("point_b", [0, 0, 0])[1],
                "point_b_z": m.get("point_b", [0, 0, 0])[2],
                "horizontal_distance_m": m.get("horizontal_dist_m", 0.0),
                "surface_3d_distance_m": m.get("surface_dist_m", 0.0),
                "elevation_difference_m": m.get("delta_elev_m", 0.0),
                "slope_degrees": m.get("slope_deg", 0.0),
                "reliability_status": m.get("reliability", "Relative"),
                "timestamp": m.get("timestamp", "")
            })

    return output_csv_path


def export_measurements_to_geojson(
    measurements: List[Dict[str, Any]],
    output_geojson_path: str
) -> str:
    """
    Exports point-to-point measurement lines as a valid GeoJSON FeatureCollection.
    """
    features = []
    for m in measurements:
        pt_a = m.get("point_a", [0, 0, 0])
        pt_b = m.get("point_b", [0, 0, 0])
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [pt_a[0], pt_a[2]],
                    [pt_b[0], pt_b[2]]
                ]
            },
            "properties": {
                "id": m.get("id", "M-1"),
                "horizontal_distance_m": m.get("horizontal_dist_m", 0.0),
                "surface_3d_distance_m": m.get("surface_dist_m", 0.0),
                "delta_elevation_m": m.get("delta_elev_m", 0.0),
                "slope_deg": m.get("slope_deg", 0.0),
                "point_a_elevation": pt_a[1],
                "point_b_elevation": pt_b[1],
                "reliability": m.get("reliability", "Relative")
            }
        }
        features.append(feature)

    collection = {
        "type": "FeatureCollection",
        "features": features
    }

    with open(output_geojson_path, 'w', encoding='utf-8') as f:
        json.dump(collection, f, indent=2)

    return output_geojson_path
