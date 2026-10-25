"""
Image Loader and Metadata Extraction Module for Satellite and Aerial Imagery.
Supports PNG, JPEG, TIFF, and GeoTIFF formats.
"""

import os
from typing import Dict, Any, Optional, Tuple
import numpy as np
from PIL import Image
import tifffile


def inspect_image_file(file_path: str) -> Dict[str, Any]:
    """
    Inspects an image file to extract dimensions, bit depth, spectral bands,
    geospatial metadata (CRS, bounds, GSD), and image quality indicators.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    filename = os.path.basename(file_path)
    file_size_bytes = os.path.getsize(file_path)
    ext = os.path.splitext(filename)[1].lower()

    georeferenced = False
    crs = None
    bounds = None
    gsd_m = None
    spectral_bands = ["Red", "Green", "Blue"]
    img_array = None

    # Attempt GeoTIFF / TIFF inspection via tifffile
    if ext in ['.tif', '.tiff']:
        try:
            with tifffile.TiffFile(file_path) as tf:
                series = tf.series[0]
                shape = series.shape
                dtype = str(series.dtype)
                page = tf.pages[0]

                # Check GeoTIFF tags (34735 = GeoKeyDirectoryTag, 33550 = ModelPixelScaleTag, 33922 = ModelTiepointTag)
                tags = page.tags
                if 33550 in tags:
                    georeferenced = True
                    pixel_scale = tags[33550].value
                    # pixel_scale: (scale_x, scale_y, scale_z)
                    gsd_m = float(pixel_scale[0])
                    crs = "GeoTIFF Projected Coordinates"

                if 33922 in tags and 33550 in tags:
                    tiepoint = tags[33922].value  # (i, j, k, x, y, z)
                    if len(tiepoint) >= 6 and len(pixel_scale) >= 2:
                        x0, y0 = tiepoint[3], tiepoint[4]
                        sx, sy = pixel_scale[0], pixel_scale[1]
                        h, w = shape[0], shape[1]
                        bounds = {
                            "min_x": float(x0),
                            "max_y": float(y0),
                            "max_x": float(x0 + w * sx),
                            "min_y": float(y0 - h * sy)
                        }

                img_array = tf.asarray()
                if img_array.ndim == 2:
                    channels = 1
                    spectral_bands = ["Panchromatic/Grayscale"]
                elif img_array.ndim == 3:
                    channels = img_array.shape[-1] if img_array.shape[-1] <= 16 else img_array.shape[0]
                    if img_array.shape[0] <= 16 and img_array.shape[-1] > 16:
                        img_array = np.transpose(img_array, (1, 2, 0))
                    if channels == 1:
                        spectral_bands = ["Panchromatic"]
                    elif channels == 3:
                        spectral_bands = ["Red", "Green", "Blue"]
                    elif channels == 4:
                        spectral_bands = ["Red", "Green", "Blue", "Near-Infrared (NIR)"]
                    else:
                        spectral_bands = [f"Band {i+1}" for i in range(channels)]
        except Exception as e:
            # Fall back to PIL
            pass

    if img_array is None:
        # Load with PIL
        with Image.open(file_path) as pil_img:
            width, height = pil_img.size
            mode = pil_img.mode
            img_array = np.array(pil_img)
            channels = 1 if img_array.ndim == 2 else img_array.shape[2]

            if mode == 'RGBA':
                spectral_bands = ["Red", "Green", "Blue", "Alpha"]
            elif mode == 'RGB':
                spectral_bands = ["Red", "Green", "Blue"]
            elif mode == 'L':
                spectral_bands = ["Grayscale"]

            # Check EXIF for GPS or resolution if available
            exif = pil_img.getexif()
            if exif:
                # GPS Info tag is 34853 (0x8825)
                if 34853 in exif:
                    georeferenced = True
                    crs = "WGS84 (GPS Embedded)"

    height, width = img_array.shape[:2]
    channels = 1 if img_array.ndim == 2 else img_array.shape[2]
    bit_depth = 16 if img_array.dtype == np.uint16 else 8

    # Quality metrics
    rgb = img_array[..., :3] if channels >= 3 else np.repeat(img_array[..., :1], 3, axis=2)
    gray = np.mean(rgb.astype(np.float32), axis=2)

    # Sharpness via variance of Laplacian approximation
    # 3x3 Laplacian kernel
    k = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=np.float32)
    # Simple spatial gradient variance
    gy, gx = np.gradient(gray)
    sharpness_score = float(np.mean(gx**2 + gy**2))

    p5, p95 = np.percentile(gray, [5, 95])
    dynamic_range = float(p95 - p5)
    mean_brightness = float(np.mean(gray))

    # Evaluate quality limitations
    quality_warnings = []
    if dynamic_range < 40:
        quality_warnings.append("Low contrast detected; radiometric equalization recommended.")
    if sharpness_score < 15.0:
        quality_warnings.append("Image shows soft focus or atmospheric haze; subtle edges may have lower detection precision.")
    if mean_brightness < 40:
        quality_warnings.append("Underexposed or shadowed scene.")
    elif mean_brightness > 220:
        quality_warnings.append("Potential specular saturation or cloud overexposure.")

    # Default GSD estimate if not georeferenced (nominal 0.3m/px for high-res drone/aerial, 0.5m for Pleiades/WorldView)
    if gsd_m is None:
        gsd_m = 0.4  # Default nominal GSD in meters per pixel
        gsd_inferred = True
    else:
        gsd_inferred = False

    return {
        "filename": filename,
        "file_size_kb": round(file_size_bytes / 1024, 2),
        "dimensions": {
            "width": int(width),
            "height": int(height)
        },
        "channels": int(channels),
        "bit_depth": int(bit_depth),
        "spectral_bands": spectral_bands,
        "georeferenced": georeferenced,
        "crs": crs or ("None (Local Cartesian Metric Coordinate System)" if not georeferenced else crs),
        "bounds": bounds,
        "gsd_m": round(gsd_m, 3),
        "gsd_inferred": gsd_inferred,
        "elevation_data_available": False,  # Will be updated if DEM layer is loaded/paired
        "elevation_source": "Derived Relative Surface Model (Monocular & Photometric)",
        "quality_metrics": {
            "mean_brightness": round(mean_brightness, 2),
            "dynamic_range": round(dynamic_range, 2),
            "sharpness_score": round(sharpness_score, 2),
            "rating": "High" if (sharpness_score > 40 and dynamic_range > 80) else ("Medium" if sharpness_score > 20 else "Fair")
        },
        "quality_warnings": quality_warnings
    }


def load_image_rgb(file_path: str) -> np.ndarray:
    """
    Loads an image file as a standardized uint8 RGB NumPy array of shape (H, W, 3).
    Handles GeoTIFF, uint16 normalization, alpha stripping, and grayscale expansion.
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext in ['.tif', '.tiff']:
        try:
            arr = tifffile.imread(file_path)
            if arr.ndim == 2:
                # Grayscale to RGB
                arr = np.stack([arr]*3, axis=-1)
            elif arr.ndim == 3:
                if arr.shape[0] in [1, 3, 4] and arr.shape[-1] > 4:
                    arr = np.transpose(arr, (1, 2, 0))
                if arr.shape[2] == 1:
                    arr = np.repeat(arr, 3, axis=2)
                elif arr.shape[2] > 3:
                    arr = arr[:, :, :3]
            # Normalize if uint16 or float
            if arr.dtype == np.uint16:
                arr = (arr / 256.0).clip(0, 255).astype(np.uint8)
            elif arr.dtype in [np.float32, np.float64]:
                if arr.max() <= 1.0:
                    arr = (arr * 255.0).clip(0, 255).astype(np.uint8)
                else:
                    p1, p99 = np.percentile(arr, [1, 99])
                    arr = np.clip((arr - p1) / max(p99 - p1, 1e-5) * 255.0, 0, 255).astype(np.uint8)
            return arr.astype(np.uint8)
        except Exception:
            pass

    # Fallback to PIL
    with Image.open(file_path) as pil_img:
        rgb_img = pil_img.convert('RGB')
        return np.array(rgb_img, dtype=np.uint8)
