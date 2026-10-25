"""
Preprocessing module for Single-Image Height Estimation (SIHE).
Handles image normalization, tile generation with overlapping margins,
cosine-window feathering matrices, and invalid pixel masking.
"""

from typing import List, Dict, Any, Tuple
import numpy as np
import cv2


def normalize_input_image(
    rgb_img: np.ndarray,
    mean: Tuple[float, float, float] = (0.485, 0.456, 0.406),
    std: Tuple[float, float, float] = (0.229, 0.224, 0.225)
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Normalizes a uint8 or float RGB image for neural network inference.
    Returns:
      - normalized_img: float32 array in range (C, H, W) normalized by mean and std
      - valid_mask: uint8 boolean mask (1 = valid, 0 = invalid/no-data/saturated)
    """
    img_float = rgb_img.astype(np.float32) / 255.0

    # Detect invalid pixels (pure black no-data or extreme specular saturation)
    gray = np.mean(img_float, axis=2)
    valid_mask = ((gray > 0.01) & (gray < 0.99)).astype(np.uint8)

    # Standardize channels
    norm = np.zeros_like(img_float)
    for c in range(3):
        norm[:, :, c] = (img_float[:, :, c] - mean[c]) / std[c]

    # Convert to channel-first (C, H, W)
    ch_first = np.transpose(norm, (2, 0, 1)).astype(np.float32)
    return ch_first, valid_mask


def generate_tiling_grid(
    height: int,
    width: int,
    tile_size: int = 512,
    overlap: int = 128
) -> List[Dict[str, int]]:
    """
    Generates tile bounding boxes with regular overlap across arbitrary dimensions.
    """
    stride = tile_size - overlap
    tiles = []

    y = 0
    while y < height:
        tile_h = min(tile_size, height - y)
        actual_y = y if (y + tile_h <= height) else max(0, height - tile_size)
        actual_h = min(tile_size, height - actual_y)

        x = 0
        while x < width:
            tile_w = min(tile_size, width - x)
            actual_x = x if (x + tile_w <= width) else max(0, width - tile_size)
            actual_w = min(tile_size, width - actual_x)

            tiles.append({
                "x": int(actual_x),
                "y": int(actual_y),
                "w": int(actual_w),
                "h": int(actual_h)
            })

            if x + tile_w >= width:
                break
            x += stride

        if y + tile_h >= height:
            break
        y += stride

    return tiles


def create_cosine_blend_window(tile_h: int, tile_w: int) -> np.ndarray:
    """
    Creates a 2D Cosine / Hann window for smooth tile-boundary blending without seam artifacts.
    Weights taper smoothly from 1.0 at tile center to near 0.0 at tile borders.
    """
    wy = np.hanning(tile_h) if tile_h > 1 else np.ones(tile_h)
    wx = np.hanning(tile_w) if tile_w > 1 else np.ones(tile_w)
    window_2d = np.outer(wy, wx).astype(np.float32)
    # Clamp minimum weight to avoid division by zero
    window_2d = np.maximum(window_2d, 1e-4)
    return window_2d
