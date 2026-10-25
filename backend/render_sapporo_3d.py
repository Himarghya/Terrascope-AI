import os
import json
import urllib.request
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from PIL import Image

def generate_sapporo_3d_render():
    job_id = "d969f98b-b83c-4464-ad36-de0cb719780b"
    scene_url = f"http://127.0.0.1:8000/api/reconstruction/{job_id}/scene"
    
    req = urllib.request.urlopen(scene_url)
    scene = json.loads(req.read().decode())
    
    orig_img_path = r"C:/Users/himar/.gemini/antigravity/scratch/satellite-3d-studio/backend/sample_data/sapporo_district.jpg"
    orig_img = Image.open(orig_img_path)
    img_w, img_h = orig_img.size
    
    buildings = scene.get("buildings", [])
    buildings_3d = scene.get("buildings_3d", [])
    trees = scene.get("trees", [])
    road_corridors = scene.get("road_corridors", [])
    roads_3d = scene.get("roads_3d", {})
    gsd_m = scene.get("gsd_m", 0.28)
    
    # Load or generate nDSM heatmap
    ndsm_url = scene.get("sihe", {}).get("visualization_url")
    ndsm_img = None
    if ndsm_url:
        local_ndsm = os.path.join(r"C:/Users/himar/.gemini/antigravity/scratch/satellite-3d-studio/backend/exports", os.path.basename(ndsm_url))
        if os.path.exists(local_ndsm):
            ndsm_img = Image.open(local_ndsm)
            
    # Set up Figure with 4 subplots
    plt.style.use('dark_background')
    fig = plt.figure(figsize=(20, 14), dpi=180)
    fig.patch.set_facecolor('#0b0f14')
    
    # -------------------------------------------------------------
    # Panel 1: Original Overhead Aerial Orthophoto + Vector Overlays
    # -------------------------------------------------------------
    ax1 = fig.add_subplot(2, 2, 1)
    ax1.set_facecolor('#0b0f14')
    ax1.imshow(orig_img)
    
    # Overlay road centerlines/polygons
    for road in road_corridors:
        poly = road.get("polygon_px", [])
        if len(poly) > 2:
            xs = [p[0] for p in poly] + [poly[0][0]]
            ys = [p[1] for p in poly] + [poly[0][1]]
            ax1.fill(xs, ys, color='#38bdf8', alpha=0.25)
            ax1.plot(xs, ys, color='#0284c7', linewidth=1.2)
            
    # Overlay building footprint polygons
    for b in buildings:
        poly = b.get("polygon_px", [])
        if len(poly) > 2:
            xs = [p[0] for p in poly] + [poly[0][0]]
            ys = [p[1] for p in poly] + [poly[0][1]]
            color = b.get("base_color_hex", "#ea580c")
            ax1.fill(xs, ys, color=color, alpha=0.45)
            ax1.plot(xs, ys, color='#ffffff', linewidth=1.2)
            
    # Overlay trees
    for t in trees:
        cx, cy = t["center_px"]
        r = (t["crown_diameter_m"] / 2) / gsd_m
        circle = plt.Circle((cx, cy), max(3, r), color='#22c55e', alpha=0.5, ec='#15803d', lw=1)
        ax1.add_patch(circle)
        
    ax1.set_title(f"A. Overhead Satellite Ingestion & Vector Segmentation\n(966×617 px · GSD: {gsd_m} m/px · 27 Buildings · 29 Trees)", fontsize=11, color='#f1f5f9', pad=10, weight='bold')
    ax1.axis('off')
    
    # -------------------------------------------------------------
    # Panel 2: SIHE Calibrated Relative DSM (Heightmap)
    # -------------------------------------------------------------
    ax2 = fig.add_subplot(2, 2, 2)
    ax2.set_facecolor('#0b0f14')
    if ndsm_img:
        ax2.imshow(ndsm_img)
    else:
        # Fallback raster
        h_map = np.zeros((img_h, img_w), dtype=np.float32)
        for b in buildings:
            poly = np.array(b["polygon_px"], dtype=np.int32)
            import cv2
            cv2.fillPoly(h_map, [poly], b["estimated_height_m"])
        im2 = ax2.imshow(h_map, cmap='turbo')
        plt.colorbar(im2, ax=ax2, shrink=0.7, label='Height above ground (m AGL)')
        
    ax2.set_title("B. Single-Image Height Estimation (SIHE nDSM)\n(Calibrated Meters AGL · HeightFormer Neural Surface Filter)", fontsize=11, color='#f1f5f9', pad=10, weight='bold')
    ax2.axis('off')
    
    # -------------------------------------------------------------
    # Panel 3: Full 3D Digital Twin Reconstruction (Perspective)
    # -------------------------------------------------------------
    ax3 = fig.add_subplot(2, 2, 3, projection='3d')
    ax3.set_facecolor('#0b0f14')
    
    # Build 3D mesh collections for buildings
    wall_polys = []
    roof_polys = []
    wall_colors = []
    roof_colors = []
    
    for mesh in buildings_3d:
        verts = np.array(mesh["vertices"])
        all_faces = mesh.get("faces", [])
        
        # In Three.js: X horizontal, Y elevation (up), Z depth (north-south)
        # In Matplotlib 3D: X=X, Y=Z (depth), Z=Y (elevation up)
        x_coords = verts[:, 0]
        y_coords = verts[:, 2] # ground depth
        z_coords = verts[:, 1] # vertical height
        
        # Walls
        w_indices = mesh.get("wall_faces", [])
        for f_idx in w_indices:
            if isinstance(f_idx, int) and f_idx < len(all_faces):
                face = all_faces[f_idx]
                tri = [[x_coords[idx], y_coords[idx], z_coords[idx]] for idx in face]
                wall_polys.append(tri)
                wall_colors.append('#d6d3d1')
            elif isinstance(f_idx, (list, tuple)):
                tri = [[x_coords[idx], y_coords[idx], z_coords[idx]] for idx in f_idx]
                wall_polys.append(tri)
                wall_colors.append('#d6d3d1')
            
        # Roofs
        r_indices = mesh.get("roof_faces", [])
        r_col_rgba = mesh.get("roof_color", [0.76, 0.35, 0.22, 1.0])
        r_hex = '#%02x%02x%02x' % (int(r_col_rgba[0]*255), int(r_col_rgba[1]*255), int(r_col_rgba[2]*255))
        for f_idx in r_indices:
            if isinstance(f_idx, int) and f_idx < len(all_faces):
                face = all_faces[f_idx]
                tri = [[x_coords[idx], y_coords[idx], z_coords[idx]] for idx in face]
                roof_polys.append(tri)
                roof_colors.append(r_hex)
            elif isinstance(f_idx, (list, tuple)):
                tri = [[x_coords[idx], y_coords[idx], z_coords[idx]] for idx in f_idx]
                roof_polys.append(tri)
                roof_colors.append(r_hex)
            
    # Add road ribbon mesh to 3D plot
    road_polys = []
    if roads_3d and "vertices" in roads_3d and "faces" in roads_3d:
        r_verts = np.array(roads_3d["vertices"])
        rx = r_verts[:, 0]
        ry = r_verts[:, 2]
        rz = r_verts[:, 1]
        for f in roads_3d["faces"]:
            if isinstance(f, (list, tuple)):
                tri = [[rx[idx], ry[idx], rz[idx]] for idx in f]
                road_polys.append(tri)
            
    if road_polys:
        rc = Poly3DCollection(road_polys, facecolors='#334155', edgecolors='none', alpha=0.9)
        ax3.add_collection3d(rc)
        
    if wall_polys:
        wc = Poly3DCollection(wall_polys, facecolors=wall_colors, edgecolors='#78716c', linewidths=0.2, alpha=0.95)
        ax3.add_collection3d(wc)
        
    if roof_polys:
        rc = Poly3DCollection(roof_polys, facecolors=roof_colors, edgecolors='#44403c', linewidths=0.3, alpha=1.0)
        ax3.add_collection3d(rc)
        
    # Extents
    world_w = img_w * gsd_m
    world_h = img_h * gsd_m
    ax3.set_xlim(-world_w/2, world_w/2)
    ax3.set_ylim(-world_h/2, world_h/2)
    ax3.set_zlim(0, 35)
    
    ax3.view_init(elev=38, azim=130)
    ax3.set_xlabel('East-West (m)', fontsize=9, color='#94a3b8')
    ax3.set_ylabel('North-South (m)', fontsize=9, color='#94a3b8')
    ax3.set_zlabel('Height AGL (m)', fontsize=9, color='#94a3b8')
    ax3.tick_params(colors='#64748b', labelsize=8)
    ax3.set_title("C. Reconstructed 3D Scene (Oblique Perspective)\n(Extruded Volumetric Walls · Parametric Roofs · Draped Roads)", fontsize=11, color='#f1f5f9', pad=10, weight='bold')
    
    # -------------------------------------------------------------
    # Panel 4: Close-up 3D Axonometric Angle View
    # -------------------------------------------------------------
    ax4 = fig.add_subplot(2, 2, 4, projection='3d')
    ax4.set_facecolor('#0b0f14')
    
    if road_polys:
        rc4 = Poly3DCollection(road_polys, facecolors='#384252', edgecolors='none', alpha=0.95)
        ax4.add_collection3d(rc4)
        
    if wall_polys:
        wc4 = Poly3DCollection(wall_polys, facecolors=wall_colors, edgecolors='#78716c', linewidths=0.3, alpha=0.95)
        ax4.add_collection3d(wc4)
        
    if roof_polys:
        rc4 = Poly3DCollection(roof_polys, facecolors=roof_colors, edgecolors='#1e293b', linewidths=0.4, alpha=1.0)
        ax4.add_collection3d(rc4)
        
    # Focus closer on the central residential core and main intersection
    ax4.set_xlim(-world_w * 0.25, world_w * 0.35)
    ax4.set_ylim(-world_h * 0.25, world_h * 0.35)
    ax4.set_zlim(0, 30)
    
    ax4.view_init(elev=24, azim=55)
    ax4.set_xlabel('X (m)', fontsize=9, color='#94a3b8')
    ax4.set_ylabel('Y (m)', fontsize=9, color='#94a3b8')
    ax4.set_zlabel('Height (m)', fontsize=9, color='#94a3b8')
    ax4.tick_params(colors='#64748b', labelsize=8)
    ax4.set_title("D. Low-Angle Architectural 3D Inspection\n(Individual Japanese Roof Pitches, Stories & Orientation Spacing)", fontsize=11, color='#f1f5f9', pad=10, weight='bold')
    
    plt.tight_layout()
    
    out_path = os.path.join(r"C:/Users/himar/.gemini/antigravity/brain/76000530-86a8-45e1-935b-a83dce89150b", "sapporo_reconstruction_3d.png")
    plt.savefig(out_path, dpi=200, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close()
    
    print(f"Render successfully saved to: {out_path}")
    print(f"File size: {os.path.getsize(out_path)} bytes")

if __name__ == "__main__":
    generate_sapporo_3d_render()
