"""
Image Preprocessing Pipeline for Satellite and Aerial Imagery.
Includes CLAHE radiometric enhancement, bilateral filtering, unsharp masking,
and scale-aware overlapping tiling.
"""

from typing import List, Dict, Any, Tuple
import numpy as np
import cv2
from PIL import Image


def enhance_satellite_image(
    rgb_img: np.ndarray,
    apply_clahe: bool = True,
    apply_denoise: bool = False,
    apply_sharpen: bool = True
) -> np.ndarray:
    """
    Enhances radiometric contrast and sharpness while preserving original spectral signatures.
    Uses LAB color space so lightness is enhanced without corrupting chromatic hue.
    """
    enhanced = rgb_img.copy()

    # Optional bilateral filter to suppress sensor noise while preserving sharp building boundaries
    if apply_denoise:
        enhanced = cv2.bilateralFilter(enhanced, d=5, sigmaColor=35, sigmaSpace=35)

    if apply_clahe:
        # Convert RGB to LAB
        lab = cv2.cvtColor(enhanced, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)

        # Contrast Limited Adaptive Histogram Equalization on L-channel
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_clahe = clahe.apply(l)

        # Merge back
        lab_enhanced = cv2.merge((l_clahe, a, b))
        enhanced = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2RGB)

    if apply_sharpen:
        # Unsharp masking for fine structural edges (e.g. roof ridges, tree crown foliage)
        gaussian = cv2.GaussianBlur(enhanced, (0, 0), sigmaX=1.5)
        enhanced = cv2.addWeighted(enhanced, 1.25, gaussian, -0.25, 0)

    return enhanced


def create_tiles(
    img_shape: Tuple[int, int],
    tile_size: int = 1024,
    overlap: int = 128
) -> List[Dict[str, Any]]:
    """
    Generates tile bounding boxes with overlap for large satellite images.
    Returns list of dicts with (x, y, w, h, inner_bbox).
    """
    h, w = img_shape
    tiles = []

    stride = tile_size - overlap
    if stride <= 0:
        stride = tile_size // 2

    y = 0
    tile_idx = 0
    while y < h:
        tile_h = min(tile_size, h - y)
        x = 0
        while x < w:
            tile_w = min(tile_size, w - x)
            tiles.append({
                "tile_id": tile_idx,
                "x": int(x),
                "y": int(y),
                "w": int(tile_w),
                "h": int(tile_h),
                # Inner region that avoids overlap borders for stitching
                "inner_x": int(x + (overlap // 2 if x > 0 else 0)),
                "inner_y": int(y + (overlap // 2 if y > 0 else 0)),
                "inner_w": int(tile_w - (overlap // 2 if x > 0 else 0) - (overlap // 2 if x + tile_w < w else 0)),
                "inner_h": int(tile_h - (overlap // 2 if y > 0 else 0) - (overlap // 2 if y + tile_h < h else 0)),
            })
            tile_idx += 1
            if x + tile_w >= w:
                break
            x += stride
        if y + tile_h >= h:
            break
    return tiles


def detect_map_ui_chrome(rgb_img: np.ndarray) -> np.ndarray:
    """
    Detects and masks out browser and web map UI overlays (e.g. Google Maps, Bing Maps,
    Mapbox search bars, category filter pills, transit cards, zoom controls, and text labels).
    Prevents artificial UI boxes from corrupting building polygon extraction and GSD estimation.
    Returns: binary mask (uint8) where 1 indicates non-satellite UI chrome.
    """
    h, w = rgb_img.shape[:2]
    ui_mask = np.zeros((h, w), dtype=np.uint8)
    gray = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2GRAY)

    # 1. Top bar: In web map screenshots, top ~75px often contains search cards and filter pills
    top_limit = min(80, h)
    top_region = rgb_img[:top_limit, :]
    top_white = (top_region[:, :, 0] > 225) & (top_region[:, :, 1] > 225) & (top_region[:, :, 2] > 225)
    num_c, labels, stats, _ = cv2.connectedComponentsWithStats(top_white.astype(np.uint8))
    has_top_ui = False
    for i in range(1, num_c):
        cw = stats[i, cv2.CC_STAT_WIDTH]
        ch = stats[i, cv2.CC_STAT_HEIGHT]
        cy = stats[i, cv2.CC_STAT_TOP]
        if ch >= 14 and cw >= 20 and cy < 70:
            card_m = cv2.dilate((labels == i).astype(np.uint8), np.ones((11, 11), np.uint8))
            ui_mask[:top_limit, :][card_m > 0] = 1
            has_top_ui = True

    if has_top_ui:
        ui_mask[:8, :] = 1

    # 2. Bottom UI cards (Transit card, copyright bar, zoom +/- controls, pegman)
    bot_y0 = max(0, h - 85)
    bot_region = rgb_img[bot_y0:, :]
    bot_white = (bot_region[:, :, 0] > 225) & (bot_region[:, :, 1] > 225) & (bot_region[:, :, 2] > 225)
    num_b, b_labels, b_stats, _ = cv2.connectedComponentsWithStats(bot_white.astype(np.uint8))
    has_bot_ui = False
    for i in range(1, num_b):
        bw = b_stats[i, cv2.CC_STAT_WIDTH]
        bh = b_stats[i, cv2.CC_STAT_HEIGHT]
        if (bh >= 16 and bw >= 30) or (bw >= 80 and bh >= 10):
            card_b = cv2.dilate((b_labels == i).astype(np.uint8), np.ones((11, 11), np.uint8))
            ui_mask[bot_y0:, :][card_b > 0] = 1
            has_bot_ui = True

    if has_bot_ui:
        ui_mask[-6:, :] = 1

    # 3. High-contrast map text labels & place names (white text with dark drop shadow)
    white_core = (gray >= 230).astype(np.uint8)
    dark_halo = (gray <= 70).astype(np.uint8)
    halo_dil = cv2.dilate(dark_halo, np.ones((3, 3), np.uint8))
    text_pixels = ((white_core > 0) & (halo_dil > 0)).astype(np.uint8)
    text_lines = cv2.morphologyEx(text_pixels, cv2.MORPH_CLOSE, np.ones((3, 17), np.uint8))
    text_mask = cv2.dilate(text_lines, np.ones((7, 7), np.uint8))
    ui_mask[text_mask > 0] = 1

    # 4. Map pin badges & point-of-interest markers (ultra-saturated circular icons when map UI is present)
    if has_top_ui or has_bot_ui:
        hsv = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2HSV)
        S, V = hsv[:, :, 1], hsv[:, :, 2]
        sat_pins = ((S > 195) & (V > 190)).astype(np.uint8)
        num_p, p_labels, p_stats, _ = cv2.connectedComponentsWithStats(sat_pins)
        pin_mask = np.zeros((h, w), dtype=np.uint8)
        for i in range(1, num_p):
            area = p_stats[i, cv2.CC_STAT_AREA]
            pw = p_stats[i, cv2.CC_STAT_WIDTH]
            ph = p_stats[i, cv2.CC_STAT_HEIGHT]
            if 25 <= area <= 650 and max(pw, ph) <= 32:
                pin_mask[p_labels == i] = 1
        pin_mask = cv2.dilate(pin_mask, np.ones((5, 5), np.uint8))
        ui_mask[pin_mask > 0] = 1

    return ui_mask


def detect_map_vector_roads(rgb_img: np.ndarray) -> np.ndarray:
    """
    Detects overlaid road vectors commonly drawn on web map screenshots (e.g. Google Maps, Bing)
    characterized by uniform low saturation, medium-high value, and elongated linear corridors.
    Returns: binary mask (uint8) where 1 indicates road corridors.
    """
    h, w = rgb_img.shape[:2]
    r = rgb_img[:, :, 0].astype(np.float32)
    g = rgb_img[:, :, 1].astype(np.float32)
    b = rgb_img[:, :, 2].astype(np.float32)
    hsv = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2HSV)
    S, V = hsv[:, :, 1], hsv[:, :, 2]

    # Neutral gray linear paths
    road_cand = (S < 14) & (V >= 115) & (V <= 165) & (np.abs(r - g) < 10) & (np.abs(g - b) < 10)
    num_r, r_labels, r_stats, _ = cv2.connectedComponentsWithStats(road_cand.astype(np.uint8))
    road_mask = np.zeros((h, w), dtype=np.uint8)
    for i in range(1, num_r):
        area = r_stats[i, cv2.CC_STAT_AREA]
        rw = r_stats[i, cv2.CC_STAT_WIDTH]
        rh = r_stats[i, cv2.CC_STAT_HEIGHT]
        aspect = max(rw, rh) / max(min(rw, rh), 1)
        if area >= 250 and (aspect >= 2.8 or max(rw, rh) >= 70):
            road_mask[r_labels == i] = 1

    return road_mask


