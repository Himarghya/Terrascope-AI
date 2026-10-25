"""
Satellite Image Tiling and Prediction Merging Module.
Handles large satellite and aerial imagery (> 1024x1024) by splitting into
overlapping tiles to prevent boundary truncation, and seamlessly merging
semantic segmentation and instance predictions.
"""

from typing import List, Dict, Any, Tuple, Callable
import numpy as np
import cv2


def compute_image_tiles(
    img_height: int,
    img_width: int,
    tile_size: int = 512,
    overlap_px: int = 64
) -> List[Dict[str, int]]:
    """
    Computes a regular grid of overlapping tile bounding boxes covering the image.
    Each tile specifies x0, y0, x1, y1 in full image coordinates.
    """
    stride = tile_size - overlap_px
    tiles = []

    y_starts = list(range(0, max(1, img_height - tile_size + stride), stride))
    if not y_starts or y_starts[-1] + tile_size < img_height:
        y_starts.append(max(0, img_height - tile_size))

    x_starts = list(range(0, max(1, img_width - tile_size + stride), stride))
    if not x_starts or x_starts[-1] + tile_size < img_width:
        x_starts.append(max(0, img_width - tile_size))

    for y0 in y_starts:
        y1 = min(img_height, y0 + tile_size)
        for x0 in x_starts:
            x1 = min(img_width, x0 + tile_size)
            tiles.append({
                "x0": x0,
                "y0": y0,
                "x1": x1,
                "y1": y1,
                "w": x1 - x0,
                "h": y1 - y0
            })

    return tiles


def run_tiled_classification(
    rgb_img: np.ndarray,
    classify_tile_fn: Callable[[np.ndarray], Tuple[np.ndarray, np.ndarray]],
    tile_size: int = 512,
    overlap_px: int = 64
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Executes semantic classification over overlapping image tiles and merges
    the predictions using maximum-confidence blending.
    """
    h, w = rgb_img.shape[:2]

    # If small enough, run direct classification
    if h <= tile_size and w <= tile_size:
        return classify_tile_fn(rgb_img)

    tiles = compute_image_tiles(h, w, tile_size, overlap_px)

    merged_class_map = np.zeros((h, w), dtype=np.uint8)
    max_conf_map = np.zeros((h, w), dtype=np.float32)

    # Cosine/linear weight mask for smooth border blending
    for tile in tiles:
        x0, y0, x1, y1 = tile["x0"], tile["y0"], tile["x1"], tile["y1"]
        tile_rgb = rgb_img[y0:y1, x0:x1]

        tile_class, tile_conf = classify_tile_fn(tile_rgb)

        # Apply weight penalty near tile boundaries to prefer inner predictions
        th, tw = tile_class.shape
        weight = np.ones((th, tw), dtype=np.float32)
        pad = min(overlap_px // 2, 32)
        if pad > 0:
            for d in range(pad):
                factor = float(d + 1) / float(pad)
                weight[d, :] *= factor
                weight[th - 1 - d, :] *= factor
                weight[:, d] *= factor
                weight[:, tw - 1 - d] *= factor

        weighted_conf = tile_conf * weight

        # Update pixels where this tile has higher weighted confidence
        cur_conf_slice = max_conf_map[y0:y1, x0:x1]
        update_mask = weighted_conf > cur_conf_slice

        merged_class_map[y0:y1, x0:x1] = np.where(update_mask, tile_class, merged_class_map[y0:y1, x0:x1])
        max_conf_map[y0:y1, x0:x1] = np.where(update_mask, weighted_conf, cur_conf_slice)

    return merged_class_map, max_conf_map
