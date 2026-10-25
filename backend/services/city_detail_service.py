"""
City Detail Coordinator Service.
Coordinates procedural architectural generation, single-building editing,
geometric validation, and multi-engine exports.
"""

from typing import Dict, Any, List, Optional
import os

from services.procedural_building_service import ProceduralBuildingGenerator
from services.city_optimization_service import CityDetailOptimizationService
from services.mesh_validation_service import validate_city_export_package, validate_mesh_geometry
from services.city_export_service import CityExportService


class CityDetailService:
    def __init__(self, export_dir: str):
        self.export_dir = export_dir
        self.building_gen = ProceduralBuildingGenerator()
        self.city_opt = CityDetailOptimizationService()
        self.exporter = CityExportService(export_dir)
        self.city_cache: Dict[str, Dict[str, Any]] = {}

    def detail_entire_city(
        self,
        scene_data: Dict[str, Any],
        detail_tier: str = "medium",
        include_props: bool = True,
        include_sidewalks: bool = True,
        city_style: str = "modern_urban"
    ) -> Dict[str, Any]:
        """
        Generates architectural details across all buildings in the scene while
        strictly preserving the underlying city layout, footprints, and heights.
        """
        job_id = scene_data.get("job_id", "scene_city")
        city_result = self.city_opt.generate_detailed_city(
            scene_data=scene_data,
            detail_tier=detail_tier,
            include_props=include_props,
            include_sidewalks=include_sidewalks,
            city_style=city_style
        )
        self.city_cache[job_id] = city_result
        return city_result

    def detail_single_building(
        self,
        scene_data: Dict[str, Any],
        building_id: str,
        style_overrides: Optional[Dict[str, Any]] = None,
        detail_tier: str = "high"
    ) -> Optional[Dict[str, Any]]:
        """
        Generates or updates architectural details for an individual building
        without re-running the entire city.
        """
        buildings = scene_data.get("buildings", [])
        target_b = next((b for b in buildings if b.get("id") == building_id), None)
        if not target_b:
            return None

        gsd_m = float(scene_data.get("gsd_m", 0.4))
        dim = scene_data.get("dimensions", {"width": 1024, "height": 1024})

        detailed_b = self.building_gen.generate_detailed_building(
            building_data=target_b,
            base_elevation_m=0.0,
            gsd_m=gsd_m,
            img_width=dim["width"],
            img_height=dim["height"],
            detail_tier=detail_tier,
            custom_style_override=style_overrides
        )

        # Update in cache if full city was already generated
        job_id = scene_data.get("job_id")
        if job_id and job_id in self.city_cache:
            c_blds = self.city_cache[job_id].get("buildings", [])
            for idx, existing in enumerate(c_blds):
                if existing.get("building_id") == building_id:
                    c_blds[idx] = detailed_b
                    break

        return detailed_b

    def validate_city(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Runs full mesh geometry and collision validation across all buildings in the detailed city.
        """
        city_data = self.city_cache.get(job_id)
        if not city_data:
            return None
        return validate_city_export_package(city_data)

    def export_city_package(
        self,
        scene_data: Dict[str, Any],
        formats: Optional[List[str]] = None,
        detail_tier: str = "medium"
    ) -> Dict[str, Any]:
        """
        Packages the detailed city into GLB, FBX, OBJ, and Blender native projects.
        """
        job_id = scene_data.get("job_id", "scene_city")
        city_data = self.city_cache.get(job_id)
        if not city_data:
            # Generate on the fly if not cached
            city_data = self.detail_entire_city(scene_data, detail_tier=detail_tier)

        return self.exporter.export_multi_engine_package(
            city_data=city_data,
            scene_data=scene_data,
            job_id=job_id,
            export_formats=formats
        )
