"""
Road Surface Segmentation, Network Extraction, and 3D Road Mesh Module.
Segments paved surfaces, extracts centerline vectors, and builds 3D terrain-following
road corridor meshes that seamlessly avoid building footprints.
"""

from typing import List, Dict, Any, Tuple
import math
import numpy as np
import cv2


def extract_road_network(
    class_map: np.ndarray,
    building_mask: np.ndarray,
    gsd_m: float = 0.4,
    min_road_area_px: int = 150
) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    Extracts road corridors from thematic classification, ensures roads
    do not intersect or draw through building footprints, and extracts
    vector corridor polygons and approximate centerlines.
    """
    h, w = class_map.shape
    raw_road_mask = ((class_map == 3) | (class_map == 5)).astype(np.uint8) * 255

    # 1. Ensure roads strictly avoid buildings with a 2-pixel security setback
    bld_u8 = (building_mask > 0).astype(np.uint8) * 255
    bld_dilated = cv2.dilate(bld_u8, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)), iterations=1)
    clean_road_mask = cv2.bitwise_and(raw_road_mask, cv2.bitwise_not(bld_dilated))

    # 2. Morphological cleanup: remove small isolated patches, close minor gaps along avenues
    kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    road_closed = cv2.morphologyEx(clean_road_mask, cv2.MORPH_CLOSE, kernel_close)
    road_opened = cv2.morphologyEx(road_closed, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))

    # 3. Find connected road corridors
    contours, hierarchy = cv2.findContours(road_opened, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    road_corridors = []
    road_id_counter = 1

    for c in contours:
        area_px = cv2.contourArea(c)
        if area_px < min_road_area_px:
            continue

        # Polygon approximation for crisp road edges
        epsilon = 0.006 * cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, epsilon, True)
        if len(approx) < 3:
            continue

        pts = [[int(pt[0][0]), int(pt[0][1])] for pt in approx]

        # Bounding box & aspect ratio
        rect = cv2.minAreaRect(c)
        (cx, cy), (dim1, dim2), angle = rect
        length_px = max(dim1, dim2)
        width_px = min(dim1, dim2)
        if length_px < 18 or (area_px < 450 and length_px / max(width_px, 1.0) < 1.8):
            continue

        road_corridors.append({
            "id": f"R{road_id_counter:03d}",
            "polygon_px": pts,
            "center_px": [round(float(cx), 1), round(float(cy), 1)],
            "surface_area_m2": round(area_px * (gsd_m ** 2), 1),
            "estimated_length_m": round(length_px * gsd_m, 1),
            "estimated_width_m": round(max(3.0, width_px * gsd_m), 1),
            "surface_type": "Asphalt Paved Surface",
            "material_color": "#334155"
        })
        road_id_counter += 1

    return road_opened, road_corridors


def generate_road_3d_mesh(
    road_corridors: List[Dict[str, Any]],
    img_width: int,
    img_height: int,
    gsd_m: float,
    dem: np.ndarray,
    elevation_offset_m: float = 0.08
) -> Dict[str, Any]:
    """
    Transforms 2D road corridor polygons into 3D terrain-following meshes using
    concave-safe ear-clipping triangulation.
    Applies elevation_offset_m to avoid Z-fighting with the underlying terrain.
    """
    from core.mesh_generator import triangulate_2d_polygon

    all_vertices = []
    all_faces = []
    dh, dw = dem.shape[:2]

    def p2w(px: float, py: float) -> Tuple[float, float, float]:
        xw = (px - (img_width / 2.0)) * gsd_m
        zw = (py - (img_height / 2.0)) * gsd_m
        ix = int(np.clip((px / max(img_width, 1)) * dw, 0, dw - 1))
        iy = int(np.clip((py / max(img_height, 1)) * dh, 0, dh - 1))
        yw = float(dem[iy, ix]) + elevation_offset_m
        return (round(xw, 2), round(yw, 2), round(zw, 2))

    for corridor in road_corridors:
        pts = corridor["polygon_px"]
        n_pts = len(pts)
        if n_pts < 3:
            continue

        base_v_idx = len(all_vertices)
        world_pts = [p2w(p[0], p[1]) for p in pts]
        pts_2d = [(wp[0], wp[2]) for wp in world_pts]
        tris = triangulate_2d_polygon(pts_2d)
        if not tris:
            continue

        for wp in world_pts:
            all_vertices.append([wp[0], wp[1], wp[2]])

        for tri in tris:
            all_faces.append([
                base_v_idx + tri[0],
                base_v_idx + tri[1],
                base_v_idx + tri[2]
            ])

    return {
        "vertices": all_vertices,
        "faces": all_faces,
        "color": [0.22, 0.25, 0.30, 1.0],  # Asphalt slate
        "total_corridors": len(road_corridors)
    }
