"""
Building Classification and Architectural Profiling Module.
Classifies detected building instances into architectural categories
based on metric footprints, estimated heights, aspect ratios, roof forms,
and spatial regularity.
"""

from typing import Dict, Any, List, Optional
import math
import numpy as np
from shapely.geometry import Polygon


# Standard Architectural Categories
BUILDING_CATEGORIES = {
    "detached_house": {
        "name": "Detached House",
        "description": "Single-family residential home with pitched or gabled roof",
        "typical_floors": (1, 2),
        "floor_height_m": 3.0,
        "window_style": "residential_sash",
        "roof_types": ["Gabled Roof", "Hipped Roof"],
        "has_balconies": False,
        "has_storefront": False,
        "wall_thickness_m": 0.25,
        "default_material": "brick_residential",
    },
    "row_house": {
        "name": "Row House / Townhouse",
        "description": "Multi-story connected urban residential building",
        "typical_floors": (2, 4),
        "floor_height_m": 3.2,
        "window_style": "regular_casement",
        "roof_types": ["Flat Roof with Parapet", "Mansard Roof", "Gabled Roof"],
        "has_balconies": True,
        "has_storefront": False,
        "wall_thickness_m": 0.30,
        "default_material": "brownstone_brick",
    },
    "apartment_block": {
        "name": "Apartment Block",
        "description": "Multi-family residential complex with repetitive window matrix",
        "typical_floors": (4, 12),
        "floor_height_m": 3.1,
        "window_style": "modern_apartment",
        "roof_types": ["Flat Roof with Parapet"],
        "has_balconies": True,
        "has_storefront": True,
        "wall_thickness_m": 0.35,
        "default_material": "stucco_concrete",
    },
    "office_building": {
        "name": "Commercial Office",
        "description": "Mid-to-high rise commercial workplace with curtain glass or paneling",
        "typical_floors": (5, 25),
        "floor_height_m": 3.8,
        "window_style": "curtain_wall_ribbon",
        "roof_types": ["Flat Roof with Parapet"],
        "has_balconies": False,
        "has_storefront": True,
        "wall_thickness_m": 0.35,
        "default_material": "glass_steel_curtain",
    },
    "commercial_building": {
        "name": "Retail & Commercial Center",
        "description": "Low-rise broad commercial center with large storefronts and loading docks",
        "typical_floors": (1, 3),
        "floor_height_m": 4.2,
        "window_style": "large_storefront",
        "roof_types": ["Flat Roof with Parapet", "Shed Roof"],
        "has_balconies": False,
        "has_storefront": True,
        "wall_thickness_m": 0.30,
        "default_material": "modern_composite_panels",
    },
    "industrial_warehouse": {
        "name": "Industrial Warehouse / Logistics",
        "description": "Large footprint single-story industrial depot with clerestory or shed roof",
        "typical_floors": (1, 2),
        "floor_height_m": 5.5,
        "window_style": "industrial_clerestory",
        "roof_types": ["Gabled Roof", "Shed Roof", "Flat Roof with Parapet"],
        "has_balconies": False,
        "has_storefront": False,
        "wall_thickness_m": 0.25,
        "default_material": "corrugated_steel",
    },
    "institutional": {
        "name": "Institutional / Civic Complex",
        "description": "Large public or institutional building with columns, porticos and wings",
        "typical_floors": (2, 6),
        "floor_height_m": 4.0,
        "window_style": "monumental_arched",
        "roof_types": ["Hipped Roof", "Flat Roof with Parapet"],
        "has_balconies": False,
        "has_storefront": False,
        "wall_thickness_m": 0.45,
        "default_material": "stone_limestone",
    },
    "generic": {
        "name": "Generic Urban Structure",
        "description": "Unclassified building with standard architectural proportions",
        "typical_floors": (1, 5),
        "floor_height_m": 3.3,
        "window_style": "standard_casement",
        "roof_types": ["Flat Roof with Parapet"],
        "has_balconies": False,
        "has_storefront": False,
        "wall_thickness_m": 0.30,
        "default_material": "concrete_painted",
    }
}


def classify_building_structure(
    building_data: Dict[str, Any],
    gsd_m: float = 0.4
) -> Dict[str, Any]:
    """
    Infers the building category, architectural parameters, and floor counts
    from original reconstructed footprint, area, height, aspect ratio, and roof.
    Strictly preserves the original footprint and estimated height!
    """
    height_m = float(building_data.get("estimated_height_m", 9.0))
    area_m2 = float(building_data.get("footprint_area_m2", 120.0))
    aspect_ratio = float(building_data.get("aspect_ratio", 1.2))
    roof_shape = building_data.get("roof_shape", "Flat Roof with Parapet")
    rooftop_units = building_data.get("rooftop_units", [])
    has_hvac = building_data.get("has_hvac_units", len(rooftop_units) > 0)

    # Classification Heuristics
    category = "generic"
    confidence = 0.70

    if height_m >= 22.0 or (height_m >= 15.0 and area_m2 > 400.0 and has_hvac):
        category = "office_building"
        confidence = 0.88
    elif height_m >= 12.0 and area_m2 >= 250.0:
        category = "apartment_block"
        confidence = 0.84
    elif area_m2 > 700.0 and height_m <= 10.0:
        category = "industrial_warehouse"
        confidence = 0.82
    elif area_m2 > 400.0 and height_m <= 12.0 and ("Flat" in roof_shape or has_hvac):
        category = "commercial_building"
        confidence = 0.80
    elif area_m2 > 500.0 and height_m > 10.0:
        category = "institutional"
        confidence = 0.76
    elif height_m <= 8.5 and area_m2 <= 220.0:
        if aspect_ratio > 1.8:
            category = "row_house"
            confidence = 0.78
        else:
            category = "detached_house"
            confidence = 0.85
    elif height_m <= 12.0 and area_m2 <= 300.0:
        if "Gabled" in roof_shape or "Hipped" in roof_shape:
            category = "detached_house"
            confidence = 0.80
        else:
            category = "row_house"
            confidence = 0.75

    spec = BUILDING_CATEGORIES[category]

    # Calculate exact floor count from height and floor height
    floor_h = spec["floor_height_m"]
    estimated_floors = max(1, int(round(height_m / floor_h)))

    # Fallback to user-assigned or pre-existing building_type if specified
    user_cat = building_data.get("user_category")
    if user_cat and user_cat in BUILDING_CATEGORIES:
        category = user_cat
        spec = BUILDING_CATEGORIES[category]
        estimated_floors = max(1, int(round(height_m / spec["floor_height_m"])))
        confidence = 1.0

    return {
        "building_id": building_data.get("id", "B_UNKNOWN"),
        "category": category,
        "category_name": spec["name"],
        "confidence": confidence,
        "estimated_floors": estimated_floors,
        "floor_height_m": floor_h,
        "wall_thickness_m": spec["wall_thickness_m"],
        "has_balconies": spec["has_balconies"] and estimated_floors >= 2,
        "has_storefront": spec["has_storefront"] and estimated_floors >= 2,
        "window_style": spec["window_style"],
        "default_material": spec["default_material"],
        "original_height_m": height_m,
        "original_area_m2": area_m2,
        "roof_profile": roof_shape,
    }
