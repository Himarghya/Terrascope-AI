"""
Semantic Land-Cover Segmentation and Classification Module.
Produces per-pixel thematic classification:
0: Background / Unclassified
1: Ground / Bare Earth / Soil
2: Grass / Low Vegetation
3: Tree Canopy / Dense Vegetation
4: Buildings / Built Structures
5: Roads / Paved Surfaces
6: Water Bodies
7: Cast Shadows
"""

from typing import Dict, Any, Tuple
import numpy as np
import cv2


CLASS_NAMES = {
    0: "Unclassified",
    1: "Bare Soil & Ground",
    2: "Grass & Low Vegetation",
    3: "Tree Canopy & Dense Vegetation",
    4: "Buildings & Built Structures",
    5: "Roads & Paved Surfaces",
    6: "Water Bodies",
    7: "Cast Shadows"
}

CLASS_COLORS = {
    0: [30, 30, 35],      # Dark Slate
    1: [194, 178, 128],   # Warm Sand / Earth
    2: [124, 186, 76],    # Light Meadow Green
    3: [34, 112, 45],     # Deep Forest Green
    4: [220, 95, 60],     # Terracotta / Brick Orange
    5: [80, 85, 95],      # Asphalt Slate Gray
    6: [45, 120, 200],    # Deep Water Azure
    7: [15, 18, 25]       # Deep Blue-Black Shadow
}


def compute_spectral_indices(rgb: np.ndarray) -> Dict[str, np.ndarray]:
    """
    Computes key remote-sensing indices from RGB spectral channels.
    """
    r = rgb[:, :, 0].astype(np.float32)
    g = rgb[:, :, 1].astype(np.float32)
    b = rgb[:, :, 2].astype(np.float32)
    denom_sum = r + g + b + 1e-6

    rn = r / denom_sum
    gn = g / denom_sum
    bn = b / denom_sum

    exg = 2.0 * gn - rn - bn
    vari_denom = g + r - b
    vari_denom = np.where(np.abs(vari_denom) < 1e-5, 1e-5, vari_denom)
    vari = (g - r) / vari_denom
    water_idx = (b - r) / (b + r + 1e-6)

    gray = 0.299 * r + 0.587 * g + 0.114 * b
    shadow_ratio = (b + 10.0) / (r + 10.0)

    gray_uint8 = np.clip(gray, 0, 255).astype(np.uint8)
    blur = cv2.GaussianBlur(gray_uint8, (5, 5), 0).astype(np.float32)
    texture_var = np.abs(gray.astype(np.float32) - blur)

    return {
        "exg": exg,
        "vari": vari,
        "water_idx": water_idx,
        "gray": gray,
        "shadow_ratio": shadow_ratio,
        "texture_var": texture_var,
        "r": r, "g": g, "b": b
    }


def classify_landcover(rgb: np.ndarray) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any]]:
    """
    Performs calibrated semantic land-cover classification.
    """
    h, w = rgb.shape[:2]
    indices = compute_spectral_indices(rgb)
    exg = indices["exg"]
    gray = indices["gray"]
    r, g, b = indices["r"], indices["g"], indices["b"]

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue = hsv[:, :, 0]
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]

    class_map = np.zeros((h, w), dtype=np.uint8)
    confidence_map = np.full((h, w), 0.5, dtype=np.float32)

    # 1. Cast Shadows (Very dark, val < 60, gray < 50)
    shadow_mask = (gray < 50) & (val < 60)
    shadow_mask = cv2.morphologyEx(shadow_mask.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    class_map[shadow_mask > 0] = 7
    confidence_map[shadow_mask > 0] = 0.90

    # 2. Water Bodies (Higher blue reflectance, low red, flat texture)
    water_mask = (b > r * 1.25) & (g > r * 1.05) & (gray < 135) & (class_map == 0)
    water_mask = cv2.morphologyEx(water_mask.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)))
    class_map[water_mask > 0] = 6
    confidence_map[water_mask > 0] = 0.88

    # 3. Vegetation (Natural chlorophyll green hue, ExG > 0.05)
    veg_mask = (exg > 0.05) & (hue >= 25) & (hue <= 95) & (sat > 30) & (class_map == 0)

    # Differentiate Tree Canopy vs Grass
    tree_mask = veg_mask & ((val < 145) | (gray < 115))
    tree_mask = cv2.morphologyEx(tree_mask.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    class_map[tree_mask > 0] = 3
    confidence_map[tree_mask > 0] = 0.87

    grass_mask = veg_mask & (class_map == 0)
    class_map[grass_mask] = 2
    confidence_map[grass_mask] = 0.84

    # 4. Roads / Paved Surfaces (Low saturation, mid gray, linear networks)
    road_mask = (sat < 35) & (gray >= 55) & (gray <= 105) & (class_map == 0)
    kernel_h = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 3))
    kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 9))
    road_filtered = cv2.morphologyEx(road_mask.astype(np.uint8), cv2.MORPH_OPEN, kernel_h) | \
                    cv2.morphologyEx(road_mask.astype(np.uint8), cv2.MORPH_OPEN, kernel_v)
    class_map[road_filtered > 0] = 5
    confidence_map[road_filtered > 0] = 0.80

    # 5. Buildings / Built Structures (Terracotta tile, bright membrane, dark composite)
    bld_terracotta = (r > 130) & (r > g * 1.15) & (r > b * 1.25)
    bld_flat = (gray > 170) & (sat < 40)
    bld_slate = (sat < 35) & (gray >= 60) & (gray <= 110)
    bld_candidate = (bld_terracotta | bld_flat | bld_slate) & (class_map == 0)

    # Clean building mask
    bld_clean = cv2.morphologyEx(bld_candidate.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)))
    class_map[bld_clean > 0] = 4
    confidence_map[bld_clean > 0] = 0.88

    # 6. Bare Ground / Soil (Remaining unclassified warm earth)
    remaining = (class_map == 0)
    class_map[remaining] = 1
    confidence_map[remaining] = 0.70

    # Statistics
    total_pixels = h * w
    stats = {}
    for code, name in CLASS_NAMES.items():
        count = int(np.sum(class_map == code))
        pct = round((count / total_pixels) * 100.0, 2)
        stats[name] = {
            "code": code,
            "pixel_count": count,
            "percentage": pct
        }

    return class_map, confidence_map, stats


def generate_colorized_classification(class_map: np.ndarray) -> np.ndarray:
    """
    Renders RGB color visualization of the landcover map.
    """
    h, w = class_map.shape
    color_img = np.zeros((h, w, 3), dtype=np.uint8)
    for code, color in CLASS_COLORS.items():
        mask = (class_map == code)
        color_img[mask] = color
    return color_img
