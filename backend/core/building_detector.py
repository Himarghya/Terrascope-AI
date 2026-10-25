"""
Building Instance Segmentation, Fine-Grained Roof Classification,
and Height / Shadow Analysis Module.
"""

from typing import List, Dict, Any, Tuple, Optional
import math
import numpy as np
import cv2
from shapely.geometry import Polygon, MultiPolygon
from shapely.validation import make_valid


def segment_building_instances(
    building_mask: np.ndarray,
    min_area_px: int = 40,
    max_area_px: int = 250000
) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    Performs distance transform watershed instance segmentation to cleanly separate
    adjacent and touching buildings into distinct instances.
    Returns:
      - instance_map: (H, W int32) where 0 is background and >0 is building instance ID
      - contours_list: List of (contour, instance_id)
    """
    h, w = building_mask.shape
    raw_binary = (building_mask > 0).astype(np.uint8)

    # Close small internal roof holes (skylights/HVAC noise) without bridging separate buildings
    k3 = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    closed = cv2.morphologyEx(raw_binary, cv2.MORPH_CLOSE, k3, iterations=1)
    # Preserve original background gaps where raw_binary had distinct separated components
    dist_raw = cv2.distanceTransform(raw_binary, cv2.DIST_L2, 5)
    binary = np.where((closed > 0) & (raw_binary == 0) & (cv2.dilate(raw_binary, k3) > 0), raw_binary, closed).astype(np.uint8)
    # Fill purely internal holes inside each building polygon
    contours_fill, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    binary_filled = np.zeros_like(binary)
    cv2.drawContours(binary_filled, contours_fill, -1, 1, thickness=cv2.FILLED)
    # Keep any true separation gap from raw_binary if contour area is large
    binary = binary_filled

    dist = cv2.distanceTransform(binary, cv2.DIST_L2, 5)

    # Per-component adaptive foreground core extraction so small and large buildings are both preserved
    num_cc, cc_labels, cc_stats, _ = cv2.connectedComponentsWithStats(binary)
    sure_fg = np.zeros((h, w), dtype=np.uint8)
    for cid in range(1, num_cc):
        if cc_stats[cid, cv2.CC_STAT_AREA] < max(4, min_area_px // 2):
            continue
        comp_mask = (cc_labels == cid)
        comp_max = float(dist[comp_mask].max()) if np.any(comp_mask) else 0.0
        if comp_max <= 0.0:
            continue
        fg_c = comp_mask & (dist >= max(1.0, 0.45 * comp_max))
        if not np.any(fg_c):
            fg_c = comp_mask
        sure_fg[fg_c] = 255

    # Unknown region between distinct buildings
    k_close = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    sure_bg = cv2.dilate(binary, k_close, iterations=1)
    unknown = cv2.subtract(sure_bg, sure_fg)

    # Connected components on sure foreground
    num_markers, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0

    # Watershed using inverted distance map as topographic relief
    dist_norm = np.clip(255.0 - (dist / max(float(dist.max()), 1.0)) * 255.0, 0, 255).astype(np.uint8)
    rgb_dummy = np.repeat(dist_norm[:, :, np.newaxis], 3, axis=2)
    markers = cv2.watershed(rgb_dummy, markers)
    markers[binary == 0] = 1

    instance_map = np.zeros((h, w), dtype=np.int32)
    instances = []

    unique_ids = np.unique(markers)
    current_inst_id = 1

    for uid in unique_ids:
        if uid <= 1:  # 0: boundary, 1: background
            continue
        mask_i = (markers == uid).astype(np.uint8)
        area_i = cv2.countNonZero(mask_i)
        if area_i < min_area_px or area_i > max_area_px:
            continue

        contours, hierarchy = cv2.findContours(mask_i, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue

        # Sort contours by area; largest is exterior
        contours_sorted = sorted(contours, key=cv2.contourArea, reverse=True)
        main_contour = contours_sorted[0]
        if cv2.contourArea(main_contour) < min_area_px:
            continue

        instance_map[mask_i > 0] = current_inst_id
        instances.append({
            "id_num": current_inst_id,
            "contour": main_contour,
            "all_contours": contours_sorted,
            "mask": mask_i,
            "area_px": area_i
        })
        current_inst_id += 1

    return instance_map, instances


def classify_roof_and_features(
    rgb: np.ndarray,
    mask: np.ndarray,
    contour: np.ndarray,
    gsd_m: float = 0.4
) -> Dict[str, Any]:
    """
    Classifies roof geometry (Flat, Gabled, Hipped, Complex), materials,
    visible roof facets, and rooftop equipment (HVAC, solar panels, skylights).
    """
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    x, y, w_box, h_box = cv2.boundingRect(contour)

    # Crop to building bounding box with margin
    pad = 2
    y0, y1 = max(0, y - pad), min(rgb.shape[0], y + h_box + pad)
    x0, x1 = max(0, x - pad), min(rgb.shape[1], x + w_box + pad)

    crop_mask = mask[y0:y1, x0:x1]
    crop_rgb = rgb[y0:y1, x0:x1]
    crop_gray = gray[y0:y1, x0:x1]

    # Calculate average color inside the building footprint
    building_pixels = crop_rgb[crop_mask > 0]
    if len(building_pixels) == 0:
        mean_rgb = [180, 180, 180]
    else:
        mean_rgb = np.mean(building_pixels, axis=0).tolist()

    r_val, g_val, b_val = mean_rgb

    # Material classification based on spectral signature
    if r_val > 140 and r_val > g_val * 1.2 and r_val > b_val * 1.3:
        roof_material = "Terracotta Ceramic Tile"
        base_color_hex = "#c25a38"
    elif r_val > 190 and g_val > 190 and b_val > 190:
        roof_material = "Reflective White Membrane / Metal Deck"
        base_color_hex = "#e5e7eb"
    elif r_val < 75 and g_val < 75 and b_val < 75:
        roof_material = "Dark Asphalt Shingle / Bitumen"
        base_color_hex = "#374151"
    elif abs(r_val - g_val) < 20 and abs(g_val - b_val) < 20:
        roof_material = "Reinforced Concrete / Gravel Built-Up Roof"
        base_color_hex = "#9ca3af"
    elif b_val > r_val * 1.15 and b_val > 120:
        roof_material = "Coated Blue/Cyan Metal Panel"
        base_color_hex = "#3b82f6"
    else:
        roof_material = "Standard Composite Shingle"
        base_color_hex = "#b45309"

    # Gradient analysis inside roof footprint for roof type & ridge detection
    sobelx = cv2.Sobel(crop_gray, cv2.CV_32F, 1, 0, ksize=3)
    sobely = cv2.Sobel(crop_gray, cv2.CV_32F, 0, 1, ksize=3)
    grad_mag = np.sqrt(sobelx**2 + sobely**2)
    grad_mag[crop_mask == 0] = 0

    # Minimum area rotated rectangle
    rect = cv2.minAreaRect(contour)
    (cx, cy), (rw, rh), angle = rect
    if rw < rh:
        rw, rh = rh, rw
        angle = (angle + 90) % 180
    orientation_deg = round(float(angle), 1)

    # Check for prominent central ridge line (indicating Pitched / Gabled roof)
    # A gabled roof will have a strong gradient discontinuity along its principal axis
    # and opposite gradient signs on either side
    grad_std = float(np.std(grad_mag[crop_mask > 0])) if np.sum(crop_mask > 0) > 0 else 0
    luminance_var = float(np.var(crop_gray[crop_mask > 0])) if np.sum(crop_mask > 0) > 0 else 0

    aspect_ratio = max(rw / max(rh, 1e-4), 1.0)

    # Rooftop equipment detection:
    # High-frequency specular points or contrasting rectangular units (HVAC, solar, water tanks)
    rooftop_units = []
    has_solar_panels = False
    has_hvac_units = False

    # High local variance inside flat roof
    diff_from_mean = np.abs(crop_gray.astype(np.float32) - np.mean(crop_gray[crop_mask > 0]))
    equipment_candidates = (diff_from_mean > 35) & (crop_mask > 0)
    eq_contours, _ = cv2.findContours(equipment_candidates.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    num_equipment = 0
    for eq_c in eq_contours:
        eq_area = cv2.contourArea(eq_c)
        # Unit size between 0.5m^2 and 15m^2
        unit_area_m2 = eq_area * (gsd_m ** 2)
        if 0.6 <= unit_area_m2 <= 20.0:
            num_equipment += 1
            eq_M = cv2.moments(eq_c)
            if eq_M["m00"] > 0:
                eq_cx = int(eq_M["m10"] / eq_M["m00"]) + x0
                eq_cy = int(eq_M["m01"] / eq_M["m00"]) + y0
                rooftop_units.append({
                    "type": "HVAC / Equipment Unit",
                    "x_px": eq_cx,
                    "y_px": eq_cy,
                    "approx_area_m2": round(float(unit_area_m2), 1)
                })

    if num_equipment >= 2:
        has_hvac_units = True

    # Solar panels check: repetitive grid of high-absorption dark blue/black rectangles
    if "Metal" in roof_material or "Concrete" in roof_material:
        dark_blue_pixels = (crop_rgb[:, :, 2] > crop_rgb[:, :, 0] * 1.1) & (crop_gray < 70) & (crop_mask > 0)
        if np.sum(dark_blue_pixels) * (gsd_m ** 2) > 8.0:
            has_solar_panels = True

    # Roof Shape Decision
    if aspect_ratio > 1.35 and grad_std > 18.0 and luminance_var > 140.0:
        roof_type = "Gabled / Pitched Roof"
        roof_sections = 2
    elif aspect_ratio <= 1.35 and grad_std > 16.0 and luminance_var > 160.0:
        roof_type = "Hipped Roof"
        roof_sections = 4
    elif aspect_ratio > 3.0:
        roof_type = "Linear / Industrial Gabled"
        roof_sections = 2
    elif luminance_var < 80.0:
        roof_type = "Flat Roof"
        roof_sections = 1
    else:
        roof_type = "Flat Roof with Parapet"
        roof_sections = 1

    return {
        "roof_type": roof_type,
        "roof_material": roof_material,
        "base_color_hex": base_color_hex,
        "roof_sections": roof_sections,
        "orientation_deg": orientation_deg,
        "aspect_ratio": round(float(aspect_ratio), 2),
        "has_solar_panels": has_solar_panels,
        "has_hvac_units": has_hvac_units,
        "rooftop_units": rooftop_units[:8]  # Limit to key detected units
    }


def estimate_building_height_from_shadow(
    contour: np.ndarray,
    shadow_mask: np.ndarray,
    gsd_m: float = 0.4,
    solar_elevation_deg: float = 45.0,
    solar_azimuth_deg: float = 135.0  # Sun from SE, shadows cast to NW (-45 deg)
) -> Dict[str, Any]:
    """
    Estimates building 3D extrusion height based on cast shadow length and solar geometry:
    Height = Shadow_Length * tan(Solar_Elevation).
    Provides honest uncertainty bounds.
    """
    h_img, w_img = shadow_mask.shape
    x, y, w, h = cv2.boundingRect(contour)

    # Create a mask for this building
    b_mask = np.zeros((h_img, w_img), dtype=np.uint8)
    cv2.drawContours(b_mask, [contour], -1, 255, -1)

    # Cast ray vector along shadow direction (opposite to solar azimuth)
    # Azimuth 135 deg (SE) -> shadow points toward 315 deg (NW)
    shadow_angle_rad = math.radians((solar_azimuth_deg + 180.0) % 360.0)
    dx = math.cos(shadow_angle_rad)
    dy = math.sin(shadow_angle_rad)

    # Sample dilation along the shadow direction to find adjacent shadow overlap
    # Dilate building footprint in the shadow direction by up to 40 pixels (approx 16 meters)
    max_search_px = 45
    shadow_overlap_lens = []

    # Get edge coordinates of building on the shadow-casting side
    kernel_dir = np.zeros((7, 7), dtype=np.uint8)
    cv2.line(kernel_dir, (3, 3), (int(3 + dx * 3), int(3 + dy * 3)), 1, thickness=1)

    dilated_b = b_mask.copy()
    shadow_found = False
    measured_shadow_len_px = 0.0

    for step in range(3, max_search_px, 3):
        # Shift mask along shadow vector
        M = np.float32([[1, 0, dx * step], [0, 1, dy * step]])
        shifted = cv2.warpAffine(b_mask, M, (w_img, h_img))
        # Overlap with detected cast shadow
        overlap = cv2.bitwise_and(shifted, shadow_mask)
        overlap_count = cv2.countNonZero(overlap)
        building_area = cv2.countNonZero(b_mask)

        if overlap_count > 0.15 * building_area:
            measured_shadow_len_px = float(step)
            shadow_found = True
        elif shadow_found and overlap_count < 0.05 * building_area:
            # End of shadow
            break

    # Solar elevation angle in radians
    sol_elev_rad = math.radians(solar_elevation_deg)
    tan_elev = math.tan(sol_elev_rad)

    if shadow_found and measured_shadow_len_px >= 3.0:
        shadow_len_m = measured_shadow_len_px * gsd_m
        est_height_m = shadow_len_m * tan_elev
        # Restrain realistic urban/suburban building bounds [2.8m, 120m]
        est_height_m = max(3.0, min(est_height_m, 120.0))
        uncertainty_m = round(max(1.2, est_height_m * 0.18), 1)
        source = "Shadow Trigonometric Geometry (Solar Azimuth/Elevation)"
        confidence = 0.84
    else:
        # Fallback to visual morphology and footprint area correlation
        # Typical residential/commercial footprint area vs height:
        # Area < 120 m² -> 1-2 stories (~3.5 - 6.5m)
        # Area 120-400 m² -> 2-3 stories (~6.0 - 10.0m)
        # Area > 400 m² -> 3-5 stories (~9.0 - 16.0m)
        area_m2 = cv2.contourArea(contour) * (gsd_m ** 2)
        if area_m2 < 120:
            est_height_m = 4.2
            uncertainty_m = 1.5
        elif area_m2 < 350:
            est_height_m = 7.5
            uncertainty_m = 2.2
        elif area_m2 < 800:
            est_height_m = 11.0
            uncertainty_m = 3.0
        else:
            est_height_m = 16.5
            uncertainty_m = 4.5
        source = "Footprint Morphology & Contextual Priors (No Clear Shadow Discovered)"
        confidence = 0.65

    est_floors = max(1, int(round(est_height_m / 3.2)))

    return {
        "estimated_height_m": round(float(est_height_m), 1),
        "height_uncertainty_m": round(float(uncertainty_m), 1),
        "estimated_floors": est_floors,
        "height_source": source,
        "height_confidence": confidence
    }


def extract_building_inventory(
    instance_map: np.ndarray,
    instances: List[Dict[str, Any]],
    rgb_img: np.ndarray,
    shadow_mask: np.ndarray,
    gsd_m: float = 0.4
) -> List[Dict[str, Any]]:
    """
    Compiles the dedicated, fine-grained Building Inventory containing
    geometric attributes, roof classification, heights, and polygons.
    """
    inventory = []

    for inst in instances:
        inst_id_num = inst["id_num"]
        building_id = f"B{inst_id_num:03d}"
        contour = inst["contour"]
        mask = inst["mask"]

        # Predominantly determine the geometric shape of the building
        rect = cv2.minAreaRect(contour)
        (cx, cy), (rw, rh), angle = rect
        if rw < rh:
            rw, rh = rh, rw
            angle = (angle + 90) % 180

        rect_area = max(rw * rh, 1.0)
        area_px = cv2.contourArea(contour)
        rectangularity = area_px / rect_area
        area_m2 = round(area_px * (gsd_m ** 2), 1)

        if rectangularity >= 0.58 or (area_m2 <= 300.0 and rectangularity >= 0.50):
            # Clean 4-corner Oriented Bounding Box
            poly = cv2.boxPoints(((cx, cy), (rw, rh), angle))
            shape_type = "Rectangle / Box"
        else:
            # Orthogonal L/T-Shape
            angle_rad = math.radians(angle)
            cos_a = math.cos(-angle_rad)
            sin_a = math.sin(-angle_rad)
            pts = contour.reshape(-1, 2).astype(np.float32) - np.array([cx, cy])
            pts_rot = np.empty_like(pts)
            pts_rot[:, 0] = pts[:, 0] * cos_a - pts[:, 1] * sin_a
            pts_rot[:, 1] = pts[:, 0] * sin_a + pts[:, 1] * cos_a
            cnt_rot = pts_rot.reshape(-1, 1, 2).astype(np.int32)
            peri = cv2.arcLength(cnt_rot, True)
            approx_rot = cv2.approxPolyDP(cnt_rot, max(1.5, 0.025 * peri), True).reshape(-1, 2).astype(np.float32)
            if len(approx_rot) >= 4:
                cos_b = math.cos(angle_rad)
                sin_b = math.sin(angle_rad)
                poly = np.empty_like(approx_rot)
                poly[:, 0] = approx_rot[:, 0] * cos_b - approx_rot[:, 1] * sin_b + cx
                poly[:, 1] = approx_rot[:, 0] * sin_b + approx_rot[:, 1] * cos_b + cy
                shape_type = "Orthogonal L/T-Shape"
            else:
                poly = cv2.boxPoints(((cx, cy), (rw, rh), angle))
                shape_type = "Rectangle / Box"

        polygon_coords = [[int(round(pt[0])), int(round(pt[1]))] for pt in poly]

        # Geometry calculations
        area_px = cv2.contourArea(contour)
        perimeter_px = cv2.arcLength(contour, True)

        area_m2 = round(area_px * (gsd_m ** 2), 1)
        perimeter_m = round(perimeter_px * gsd_m, 1)

        # Min area rotated rect for dimensions
        rect = cv2.minAreaRect(contour)
        (cx, cy), (dim1, dim2), angle = rect
        length_m = round(max(dim1, dim2) * gsd_m, 1)
        width_m = round(min(dim1, dim2) * gsd_m, 1)

        # Compactness / Shape Regularity (Isoperimetric quotient: 4 * pi * Area / Perimeter^2)
        regularity = round(float((4.0 * math.pi * area_px) / max(perimeter_px**2, 1e-5)), 2)
        regularity = min(1.0, max(0.1, regularity))

        # Roof & feature classification
        roof_info = classify_roof_and_features(rgb_img, mask, contour, gsd_m)

        # Height & Shadow analysis
        height_info = estimate_building_height_from_shadow(contour, shadow_mask, gsd_m)
        est_height = height_info["estimated_height_m"]
        est_floors = height_info["estimated_floors"]

        # Intelligent building typology classification
        if est_height >= 24.0 or est_floors >= 8:
            building_type = "High-Rise Commercial Tower"
        elif "Linear" in roof_info["roof_type"] or (area_m2 >= 650 and roof_info["aspect_ratio"] >= 2.0):
            building_type = "Industrial Logistics / Warehouse"
        elif roof_info["has_hvac_units"] or (area_m2 >= 450 and est_floors >= 4):
            building_type = "Commercial Office / Retail Center"
        elif area_m2 >= 350 and est_floors >= 3:
            building_type = "Multi-Family Residential / Apartment"
        elif regularity < 0.45 or len(polygon_coords) >= 8:
            building_type = "Institutional / Public Facility"
        elif area_m2 < 300 and est_floors <= 2:
            building_type = "Residential Single-Family / Villa"
        else:
            building_type = "Mixed-Use Urban Structure"

        inventory.append({
            "id": building_id,
            "building_type": building_type,
            "center_px": [round(float(cx), 1), round(float(cy), 1)],
            "footprint_area_m2": area_m2,
            "perimeter_m": perimeter_m,
            "length_m": length_m,
            "width_m": width_m,
            "shape_regularity": regularity,
            "roof_shape": roof_info["roof_type"],
            "roof_material": roof_info["roof_material"],
            "base_color_hex": roof_info["base_color_hex"],
            "roof_sections": roof_info["roof_sections"],
            "orientation_deg": roof_info["orientation_deg"],
            "aspect_ratio": roof_info["aspect_ratio"],
            "has_solar_panels": roof_info["has_solar_panels"],
            "has_hvac_units": roof_info["has_hvac_units"],
            "rooftop_units": roof_info["rooftop_units"],
            "estimated_height_m": est_height,
            "height_uncertainty_m": height_info["height_uncertainty_m"],
            "estimated_floors": est_floors,
            "height_source": height_info["height_source"],
            "confidence": round((0.85 + 0.15 * regularity) * height_info["height_confidence"], 2),
            "polygon_px": polygon_coords
        })


    return inventory
