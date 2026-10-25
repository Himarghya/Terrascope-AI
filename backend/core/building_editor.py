"""
Building Segmentation Editor and Geometry Modifier Module.
Provides interactive operations to split, merge, delete, and correct detected
building masks and footprints, with real-time 3D mesh regeneration.
"""

from typing import Dict, Any, List, Optional, Tuple
import math
import numpy as np
from shapely.geometry import Polygon, LineString, MultiPolygon
from shapely.ops import split as shapely_split, unary_union

from core.mesh_generator import generate_building_3d_mesh


def delete_building_from_scene(scene: Dict[str, Any], building_id: str) -> bool:
    """
    Deletes a building from the scene inventory and 3D mesh collection.
    Recalculates built-up area and statistics.
    """
    buildings = scene.get("buildings", [])
    buildings_3d = scene.get("buildings_3d", [])

    idx_bld = next((i for i, b in enumerate(buildings) if b["id"] == building_id), None)
    if idx_bld is None:
        return False

    removed_bld = buildings.pop(idx_bld)

    # Remove corresponding 3D mesh
    idx_3d = next((i for i, m in enumerate(buildings_3d) if m["building_id"] == building_id), None)
    if idx_3d is not None:
        buildings_3d.pop(idx_3d)

    # Update summary stats
    if "summary_stats" in scene:
        stats = scene["summary_stats"]
        stats["total_buildings"] = len(buildings)
        stats["built_up_area_m2"] = max(0.0, round(stats["built_up_area_m2"] - removed_bld.get("footprint_area_m2", 0.0), 1))

    return True


def merge_buildings_in_scene(
    scene: Dict[str, Any],
    building_id_1: str,
    building_id_2: str
) -> Optional[Dict[str, Any]]:
    """
    Merges two adjacent building footprints into a single unified building.
    Uses Shapely union, updates metadata, and regenerates 3D mesh.
    """
    buildings = scene.get("buildings", [])
    b1 = next((b for b in buildings if b["id"] == building_id_1), None)
    b2 = next((b for b in buildings if b["id"] == building_id_2), None)

    if not b1 or not b2:
        return None

    poly1 = Polygon(b1["polygon_px"])
    poly2 = Polygon(b2["polygon_px"])

    # Union the two footprints
    merged_poly = unary_union([poly1, poly2])
    if isinstance(merged_poly, MultiPolygon):
        # Pick the largest polygon or convex hull if disconnected
        merged_poly = max(merged_poly.geoms, key=lambda p: p.area)

    new_coords = [[int(round(pt[0])), int(round(pt[1]))] for pt in list(merged_poly.exterior.coords)[:-1]]
    if len(new_coords) < 3:
        return None

    # Weighted height and properties
    area1 = b1.get("footprint_area_m2", 100.0)
    area2 = b2.get("footprint_area_m2", 100.0)
    total_area = area1 + area2

    avg_height = round((b1["estimated_height_m"] * area1 + b2["estimated_height_m"] * area2) / max(total_area, 1.0), 1)
    new_id = f"{building_id_1}+{building_id_2.replace('B', '')}"

    merged_building = {
        "id": new_id,
        "building_type": b1.get("building_type", "Commercial Office / Retail Center"),
        "center_px": [round(float(merged_poly.centroid.x), 1), round(float(merged_poly.centroid.y), 1)],
        "footprint_area_m2": round(total_area, 1),
        "perimeter_m": round(merged_poly.length * scene.get("gsd_m", 0.4), 1),
        "length_m": max(b1.get("length_m", 10.0), b2.get("length_m", 10.0)),
        "width_m": max(b1.get("width_m", 8.0), b2.get("width_m", 8.0)),
        "shape_regularity": round((b1.get("shape_regularity", 0.7) + b2.get("shape_regularity", 0.7)) / 2.0, 2),
        "roof_shape": b1.get("roof_shape", "Flat Roof with Parapet"),
        "roof_material": b1.get("roof_material", "Concrete Slab"),
        "base_color_hex": b1.get("base_color_hex", "#c25a38"),
        "roof_sections": 1,
        "orientation_deg": b1.get("orientation_deg", 0.0),
        "aspect_ratio": 1.2,
        "has_solar_panels": b1.get("has_solar_panels", False) or b2.get("has_solar_panels", False),
        "has_hvac_units": b1.get("has_hvac_units", False) or b2.get("has_hvac_units", False),
        "rooftop_units": b1.get("rooftop_units", []) + b2.get("rooftop_units", []),
        "estimated_height_m": avg_height,
        "height_uncertainty_m": round(max(b1.get("height_uncertainty_m", 1.5), b2.get("height_uncertainty_m", 1.5)), 1),
        "estimated_floors": max(1, int(round(avg_height / 3.2))),
        "height_source": "User Interactive Merge Correction",
        "validation_status": "User Ground-Truth Corrected",
        "confidence": 0.95,
        "polygon_px": new_coords
    }

    # Remove the 2 old buildings
    delete_building_from_scene(scene, building_id_1)
    delete_building_from_scene(scene, building_id_2)

    # Insert merged building
    scene["buildings"].append(merged_building)

    # Regenerate 3D mesh
    w = scene["dimensions"]["width"]
    h = scene["dimensions"]["height"]
    gsd_m = scene["gsd_m"]
    dem = np.zeros((h, w), dtype=np.float32)
    if "terrain_mesh_data" in scene:
        grid_w = scene["terrain_mesh_data"]["grid_width"]
        grid_h = scene["terrain_mesh_data"]["grid_height"]
        elevs = np.array(scene["terrain_mesh_data"]["elevations"], dtype=np.float32).reshape((grid_h, grid_w))
        import cv2
        dem = cv2.resize(elevs, (w, h))

    mesh_3d = generate_building_3d_mesh(merged_building, w, h, gsd_m, dem)
    scene["buildings_3d"].append(mesh_3d)

    # Update summary stats
    if "summary_stats" in scene:
        scene["summary_stats"]["total_buildings"] = len(scene["buildings"])
        scene["summary_stats"]["built_up_area_m2"] = round(sum(b["footprint_area_m2"] for b in scene["buildings"]), 1)

    return merged_building


def split_building_in_scene(
    scene: Dict[str, Any],
    building_id: str,
    split_orientation: str = "minor_axis"
) -> Optional[List[Dict[str, Any]]]:
    """
    Bisects an existing building into two distinct building instances.
    Calculates cutting line across centroid and splits polygon.
    """
    buildings = scene.get("buildings", [])
    b = next((b for b in buildings if b["id"] == building_id), None)
    if not b:
        return None

    poly = Polygon(b["polygon_px"])
    if poly.area < 50:
        return None  # Too small to split

    minx, miny, maxx, maxy = poly.bounds
    cx, cy = poly.centroid.x, poly.centroid.y

    # Cut perpendicular to long axis
    width = maxx - minx
    height = maxy - miny

    if split_orientation == "major_axis" or width > height:
        # Cut vertical line through centroid
        line = LineString([(cx, miny - 20), (cx, maxy + 20)])
    else:
        # Cut horizontal line through centroid
        line = LineString([(minx - 20, cy), (maxx + 20, cy)])

    try:
        split_result = shapely_split(poly, line)
        parts = [geom for geom in split_result.geoms if geom.area > 20]
    except Exception:
        return None

    if len(parts) < 2:
        return None

    # Prepare two new sub-buildings
    sub_buildings = []
    w = scene["dimensions"]["width"]
    h = scene["dimensions"]["height"]
    gsd_m = scene["gsd_m"]
    dem = np.zeros((h, w), dtype=np.float32)
    if "terrain_mesh_data" in scene:
        grid_w = scene["terrain_mesh_data"]["grid_width"]
        grid_h = scene["terrain_mesh_data"]["grid_height"]
        elevs = np.array(scene["terrain_mesh_data"]["elevations"], dtype=np.float32).reshape((grid_h, grid_w))
        import cv2
        dem = cv2.resize(elevs, (w, h))

    # Remove old building
    delete_building_from_scene(scene, building_id)

    letters = ["A", "B", "C"]
    for i, part in enumerate(parts[:2]):
        sub_id = f"{building_id}-{letters[i]}"
        pts = [[int(round(pt[0])), int(round(pt[1]))] for pt in list(part.exterior.coords)[:-1]]
        area_m2 = round(part.area * (gsd_m ** 2), 1)

        sub_bld = dict(b)
        sub_bld["id"] = sub_id
        sub_bld["polygon_px"] = pts
        sub_bld["footprint_area_m2"] = area_m2
        sub_bld["center_px"] = [round(float(part.centroid.x), 1), round(float(part.centroid.y), 1)]
        sub_bld["height_source"] = "User Interactive Split Correction"
        sub_bld["validation_status"] = "User Ground-Truth Corrected"

        scene["buildings"].append(sub_bld)
        mesh_3d = generate_building_3d_mesh(sub_bld, w, h, gsd_m, dem)
        scene["buildings_3d"].append(mesh_3d)
        sub_buildings.append(sub_bld)

    # Update summary stats
    if "summary_stats" in scene:
        scene["summary_stats"]["total_buildings"] = len(scene["buildings"])
        scene["summary_stats"]["built_up_area_m2"] = round(sum(b["footprint_area_m2"] for b in scene["buildings"]), 1)

    return sub_buildings
