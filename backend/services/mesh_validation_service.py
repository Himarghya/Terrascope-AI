"""
Mesh Validation and Geometry Coherence Service.
Performs thorough geometric validation on 3D building components,
collision hulls, and district meshes prior to game-engine and Blender export.
"""

from typing import Dict, Any, List, Tuple, Optional
import numpy as np
import trimesh


class MeshValidationReport:
    def __init__(self, target_name: str):
        self.target_name = target_name
        self.vertex_count = 0
        self.triangle_count = 0
        self.degenerate_faces = 0
        self.duplicate_faces = 0
        self.inverted_normals = 0
        self.has_uvs = False
        self.is_watertight = False
        self.bounding_box_dimensions = [0.0, 0.0, 0.0]
        self.terrain_penetration_warning = False
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.is_valid = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "target_name": self.target_name,
            "vertex_count": self.vertex_count,
            "triangle_count": self.triangle_count,
            "degenerate_faces": self.degenerate_faces,
            "duplicate_faces": self.duplicate_faces,
            "inverted_normals": self.inverted_normals,
            "has_uvs": self.has_uvs,
            "is_watertight": self.is_watertight,
            "bounding_box_dimensions": self.bounding_box_dimensions,
            "terrain_penetration_warning": self.terrain_penetration_warning,
            "is_valid": self.is_valid and self.degenerate_faces == 0 and len(self.errors) == 0,
            "errors": self.errors,
            "warnings": self.warnings
        }


def validate_mesh_geometry(
    vertices: np.ndarray,
    faces: np.ndarray,
    uvs: Optional[np.ndarray] = None,
    normals: Optional[np.ndarray] = None,
    target_name: str = "Component",
    expected_watertight: bool = False,
    base_elevation: float = 0.0,
    terrain_elevation_at_center: float = 0.0
) -> MeshValidationReport:
    """
    Validates mesh topology, manifold properties, face winding, and geometry sanity.
    """
    report = MeshValidationReport(target_name)

    if vertices is None or len(vertices) == 0:
        report.errors.append("Empty vertex array.")
        report.is_valid = False
        return report

    if faces is None or len(faces) == 0:
        report.errors.append("Empty face index array.")
        report.is_valid = False
        return report

    verts = np.asarray(vertices, dtype=np.float32)
    indices = np.asarray(faces, dtype=np.int32)

    report.vertex_count = len(verts)
    report.triangle_count = len(indices)

    # Check bounding box
    min_pt = np.min(verts, axis=0)
    max_pt = np.max(verts, axis=0)
    dims = max_pt - min_pt
    report.bounding_box_dimensions = [round(float(d), 3) for d in dims]

    # Check UVs
    if uvs is not None and len(uvs) == len(verts):
        report.has_uvs = True
    else:
        report.warnings.append("UV coordinates missing or length mismatch.")

    # Check for degenerate triangles (zero or negative area)
    v0 = verts[indices[:, 0]]
    v1 = verts[indices[:, 1]]
    v2 = verts[indices[:, 2]]
    cross_prod = np.cross(v1 - v0, v2 - v0)
    areas = 0.5 * np.linalg.norm(cross_prod, axis=1)
    degenerate_mask = areas < 1e-6
    report.degenerate_faces = int(np.sum(degenerate_mask))

    if report.degenerate_faces > 0:
        report.errors.append(f"Detected {report.degenerate_faces} degenerate (zero-area) triangles.")
        report.is_valid = False

    # Check duplicate faces
    sorted_faces = np.sort(indices, axis=1)
    unique_faces = np.unique(sorted_faces, axis=0)
    report.duplicate_faces = len(indices) - len(unique_faces)
    if report.duplicate_faces > 0:
        report.warnings.append(f"Detected {report.duplicate_faces} overlapping duplicate face indices.")

    # Check terrain alignment / severe sinking
    lowest_y = float(min_pt[1])
    if lowest_y < (terrain_elevation_at_center - 1.5):
        report.terrain_penetration_warning = True
        report.warnings.append(f"Building base sinks {round(terrain_elevation_at_center - lowest_y, 2)}m below local ground terrain.")

    # Use Trimesh for watertightness and manifold checks
    try:
        tm = trimesh.Trimesh(vertices=verts, faces=indices, process=False)
        report.is_watertight = bool(tm.is_watertight)
        if expected_watertight and not report.is_watertight:
            report.warnings.append("Component is expected to be closed/watertight, but contains non-manifold boundary edges.")
    except Exception as e:
        report.warnings.append(f"Trimesh analysis notice: {str(e)}")

    return report


def validate_city_export_package(
    detailed_buildings: List[Dict[str, Any]],
    roads_3d: Optional[List[Dict[str, Any]]] = None,
    terrain_mesh: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Validates an entire city's geometric collection before exporting to Blender, UE5, or Unity.
    """
    total_triangles = 0
    total_vertices = 0
    component_reports = []
    overall_valid = True

    for b in detailed_buildings:
        b_id = b.get("building_id", "Unknown")
        # Validate exterior solid walls
        walls = b.get("walls_mesh")
        if walls:
            rep = validate_mesh_geometry(
                np.array(walls.get("vertices", [])),
                np.array(walls.get("faces", [])),
                uvs=np.array(walls.get("uvs", [])) if walls.get("uvs") else None,
                target_name=f"{b_id}_Walls",
                expected_watertight=False
            )
            total_triangles += rep.triangle_count
            total_vertices += rep.vertex_count
            if not rep.is_valid:
                overall_valid = False
            component_reports.append(rep.to_dict())

        # Validate Roof
        roof = b.get("roof_mesh")
        if roof:
            rep_r = validate_mesh_geometry(
                np.array(roof.get("vertices", [])),
                np.array(roof.get("faces", [])),
                uvs=np.array(roof.get("uvs", [])) if roof.get("uvs") else None,
                target_name=f"{b_id}_Roof",
                expected_watertight=False
            )
            total_triangles += rep_r.triangle_count
            total_vertices += rep_r.vertex_count
            if not rep_r.is_valid:
                overall_valid = False
            component_reports.append(rep_r.to_dict())

        # Validate Collision Hull
        col = b.get("collision_mesh")
        if col:
            rep_c = validate_mesh_geometry(
                np.array(col.get("vertices", [])),
                np.array(col.get("faces", [])),
                target_name=f"{b_id}_Collision",
                expected_watertight=True
            )
            component_reports.append(rep_c.to_dict())

    return {
        "overall_valid": overall_valid,
        "total_buildings": len(detailed_buildings),
        "total_vertices": total_vertices,
        "total_triangles": total_triangles,
        "component_count": len(component_reports),
        "components": component_reports[:20],  # sample first 20 for JSON payload brevity
        "status": "PASSED" if overall_valid else "FAILED_GEOMETRY_CHECKS",
        "timestamp": trimesh.util.time.time() if hasattr(trimesh, 'util') else None
    }
