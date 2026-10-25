"""
Advanced Vegetation Intelligence and Individual Tree Crown Segmentation Module.
Detects individual tree crowns, crown diameter, crown area, allometric canopy height,
broadleaf vs conifer vs palm categorization, and health indices.
"""

from typing import List, Dict, Any, Tuple
import math
import numpy as np
import cv2


def extract_individual_tree_crowns(
    rgb_img: np.ndarray,
    tree_canopy_mask: np.ndarray,
    gsd_m: float = 0.4,
    min_crown_radius_px: int = 3,
    max_crown_radius_px: int = 50
) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    Separates individual tree crowns within dense or isolated canopy regions using
    Gaussian-smoothed distance-transform apex peaks and watershed segmentation.
    """
    h, w = tree_canopy_mask.shape
    binary = (tree_canopy_mask > 0).astype(np.uint8)

    if cv2.countNonZero(binary) == 0:
        return np.zeros((h, w), dtype=np.int32), []

    # Calculate Excess Green Index for vegetation vitality
    r = rgb_img[:, :, 0].astype(np.float32)
    g = rgb_img[:, :, 1].astype(np.float32)
    b = rgb_img[:, :, 2].astype(np.float32)
    exg = (2.0 * g - r - b) / (r + g + b + 1e-6)

    # Clean canopy mask
    clean_tree = cv2.morphologyEx(binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    dist = cv2.distanceTransform(clean_tree, cv2.DIST_L2, 5)
    dist_smooth = cv2.GaussianBlur(dist, (9, 9), 2.0)

    # Local maxima apex peaks
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    peaks = (dist_smooth == cv2.dilate(dist_smooth, kernel)) & (dist_smooth > 4.0)
    num_peaks, markers = cv2.connectedComponents(peaks.astype(np.uint8))

    if num_peaks == 0:
        return np.zeros((h, w), dtype=np.int32), []

    # Non-tree pixels assigned to background marker (num_peaks + 1)
    bg_mask = (clean_tree == 0)
    markers[bg_mask] = num_peaks + 1

    # Watershed separation
    rgb_dummy = np.ascontiguousarray(cv2.cvtColor(clean_tree * 255, cv2.COLOR_GRAY2BGR))
    cv2.watershed(rgb_dummy, markers)

    crown_instances = []
    tree_map = np.zeros((h, w), dtype=np.int32)
    tree_centers = []
    current_tree_idx = 1

    for uid in range(1, num_peaks + 1):
        c_mask = (markers == uid).astype(np.uint8)
        c_area_px = cv2.countNonZero(c_mask)

        # Enforce realistic tree crown pixel sizes (e.g. 1.5m to 25m diameter)
        min_px = int(math.pi * (min_crown_radius_px ** 2))
        max_px = int(math.pi * (max_crown_radius_px ** 2))

        if c_area_px < min_px or c_area_px > max_px:
            continue

        contours, _ = cv2.findContours(c_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        main_c = max(contours, key=cv2.contourArea)

        M = cv2.moments(main_c)
        if M["m00"] == 0:
            continue
        cx = float(M["m10"] / M["m00"])
        cy = float(M["m01"] / M["m00"])

        tree_map[c_mask > 0] = current_tree_idx
        tree_centers.append((cx, cy))

        crown_instances.append({
            "idx": current_tree_idx,
            "cx": cx,
            "cy": cy,
            "area_px": c_area_px,
            "contour": main_c,
            "mask": c_mask
        })
        current_tree_idx += 1

    # Now classify vegetation attributes
    inventory = []

    for item in crown_instances:
        idx = item["idx"]
        tree_id = f"TREE-{idx:03d}"
        cx, cy = item["cx"], item["cy"]
        area_px = item["area_px"]
        contour = item["contour"]
        mask = item["mask"]

        area_m2 = round(area_px * (gsd_m ** 2), 1)
        diam_m = round(2.0 * math.sqrt(area_m2 / math.pi), 1)

        perim_px = cv2.arcLength(contour, True)
        circularity = round((4.0 * math.pi * area_px) / max(perim_px**2, 1e-5), 2)
        circularity = min(1.0, max(0.1, circularity))

        crown_pixels = rgb_img[mask > 0]
        if len(crown_pixels) > 0:
            mean_c = np.mean(crown_pixels, axis=0)
            std_c = np.std(crown_pixels, axis=0)
            mean_exg = float(np.mean(exg[mask > 0]))
        else:
            mean_c = [30, 110, 40]
            std_c = [10, 10, 10]
            mean_exg = 0.2

        r_m, g_m, b_m = mean_c

        # Categorize broad visual type
        if diam_m < 2.5:
            veg_category = "Shrub / Ornamental Bush"
            species_note = "Low woody shrub (Species uncertain from nadir aerial imagery)"
            tree_model_type = "shrub"
        elif g_m < 95 and r_m < 65:
            veg_category = "Coniferous Tree (Needleleaf)"
            species_note = "Conifer / Pine / Spruce-like (Species uncertain; multispectral band integration recommended)"
            tree_model_type = "conifer"
        elif circularity > 0.82 and diam_m < 5.0 and (g_m > 120):
            veg_category = "Palm / Subtropical Canopy"
            species_note = "Palm-like (Arecaceae family, species uncertain)"
            tree_model_type = "palm"
        else:
            veg_category = "Broadleaf Deciduous Tree"
            species_note = "Broadleaf crown (Species uncertain without high-resolution seasonal or spectral phenology)"
            tree_model_type = "broadleaf"

        # Allometric canopy height estimation
        if tree_model_type == "shrub":
            canopy_height_m = round(max(0.8, min(diam_m * 0.7, 2.8)), 1)
            uncertainty_m = 0.6
        elif tree_model_type == "conifer":
            canopy_height_m = round(max(4.0, 2.5 * (diam_m ** 0.8)), 1)
            uncertainty_m = round(canopy_height_m * 0.22, 1)
        elif tree_model_type == "palm":
            canopy_height_m = round(max(4.5, min(diam_m * 1.8, 14.0)), 1)
            uncertainty_m = 1.8
        else:  # Broadleaf
            canopy_height_m = round(max(3.5, 2.1 * (diam_m ** 0.75)), 1)
            uncertainty_m = round(canopy_height_m * 0.20, 1)

        distances = [math.hypot(cx - ocx, cy - ocy) * gsd_m for ocx, ocy in tree_centers if (ocx != cx or ocy != cy)]
        min_dist_m = round(min(distances), 1) if distances else 99.0
        clustering_status = "Isolated Standalone" if min_dist_m > 12.0 else ("Semi-Clustered" if min_dist_m > 5.0 else "Dense Cluster / Canopy")

        vitality = "Healthy / High Photosynthetic Vigour" if mean_exg > 0.18 else ("Moderate Vigour" if mean_exg > 0.08 else "Stressed / Senescent")

        eps = 0.02 * cv2.arcLength(contour, True)
        approx_c = cv2.approxPolyDP(contour, eps, True)
        poly_coords = [[int(pt[0][0]), int(pt[0][1])] for pt in approx_c]

        inventory.append({
            "id": tree_id,
            "center_px": [round(cx, 1), round(cy, 1)],
            "crown_area_m2": area_m2,
            "crown_diameter_m": diam_m,
            "estimated_canopy_height_m": canopy_height_m,
            "height_uncertainty_m": uncertainty_m,
            "vegetation_category": veg_category,
            "tree_model_type": tree_model_type,
            "species_classification": species_note,
            "clustering_status": clustering_status,
            "nearest_neighbor_dist_m": min_dist_m,
            "vitality_status": vitality,
            "exg_index": round(mean_exg, 3),
            "crown_density": round(float(np.mean(std_c) / 35.0), 2),
            "detection_confidence": round(0.82 + 0.10 * circularity, 2),
            "polygon_px": poly_coords
        })

    return tree_map, inventory
