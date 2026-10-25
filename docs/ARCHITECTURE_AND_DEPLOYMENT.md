# System Architecture, 3D Graphics Engine, and Production Deployment Guide

**Project:** Terrascope AI / GeoDepth 3D  
**Author:** Senior Full-Stack Architect & Real-Time 3D Graphics Engineer  
**Frameworks:** React 19, Three.js, React Three Fiber, FastAPI, PyTorch (CUDA)  

---

## 1. 3D Graphics Architecture & Player Controller Analysis

### 1.1 Three.js vs. Cesium Integration Trade-off
Phase 7 evaluates integrating first-person player controllers:
- [hh-hang/three-player-controller](https://github.com/hh-hang/three-player-controller)
- [hh-hang/cesium-player-controller](https://github.com/hh-hang/cesium-player-controller)

**Architectural Decision**:
The active Terrascope AI viewer is built natively on **Three.js and `@react-three/fiber`** (`frontend/src/components/viewer3d/SceneCanvas.tsx`).
- Injecting Cesium into this application would create a **second WebGL canvas and redundant render loop**, causing severe VRAM exhaustion, context-loss crashes, and doubled memory footprint on laptops.
- Therefore, **`three-player-controller`** is the only compatible choice. It attaches directly to the existing Three.js camera, scene graph, and animation tick loop.

### 1.2 Collision Detection Pipeline
Collision detection in the 3D scene operates on a multi-tiered spatial strategy:
1. **Vertical Ground Clamping**:
   - Downward raycasting from the camera/player position:
     $$\mathbf{r}(t) = \mathbf{p}_{\text{player}} - t \cdot \hat{\mathbf{j}}$$
   - Intersects with the terrain mesh or planar datum to maintain eye-height ($1.7\text{ m}$).
2. **Horizontal Wall Obstacle Testing**:
   - Rather than testing against millions of terrain triangles, collision geometry is decoupled from visual geometry.
   - Buildings are represented as simplified 2D bounding boxes and convex hull polygons extruded vertically:
     $$\mathbf{p}_{xz} \in \text{Polygon}_i \quad \text{and} \quad 0 \le y \le H_i$$
   - A circle-polygon distance test prevents the camera/player from passing through building walls.
3. **Large Scene Scale Optimization (BVH / Octree)**:
   - For scenes with $>100$ structures, building footprints are partitioned into a **2D Quadtree or Bounding Volume Hierarchy (BVH)** in memory. Raycasts query only the local quadtree node containing the player, reducing intersection complexity from $\mathcal{O}(N)$ to $\mathcal{O}(\log N)$.

### 1.3 Rendering Optimizations for Low-End Hardware
- **Instanced Mesh Rendering**: All trees in the scene share a single `InstancedMesh` with one draw call, applying per-instance $4 \times 4$ transformation matrices for position, scale, and rotation.
- **Frustum Culling**: Three.js automatically discards building meshes located outside the camera's viewing frustum.
- **Level of Detail (LOD)**: Distant buildings ($>200\text{ m}$) render as simple untextured bounding boxes, while foreground buildings render multi-segment eaves and photo-sampled roofs.

---

## 2. Client vs. Server Responsibility Matrix

| Responsibility Domain | Executed on Client (Browser) | Executed on Server (FastAPI / CUDA) | Rationale |
| :--- | :---: | :---: | :--- |
| **User Interface & Navigation** | Yes | No | Instantaneous responsiveness, zero server latency for tab changes. |
| **Real-time 3D Scene Rendering** | Yes | No | Utilizes local GPU via WebGL; 60 FPS interactive orbit/pan/zoom. |
| **Instant GSD Re-scaling** | Yes | No | Client recomputes world geometry matrix ($X \times \text{GSD}$) without re-running neural inference. |
| **Deep Neural Network Forward Pass** | No | Yes | ResNet50 U-Net requires 4-8 GB VRAM and CUDA tensor cores; browser download of 128MB weights would bottleneck networks. |
| **Sliding-Window Hanning Tiling** | No | Yes | Server performs overlapping patch assembly and seam blending with float32 precision. |
| **Geospatial GeoTIFF Parsing** | No | Yes | GDAL/Rasterio and Proj4 handle complex projections, coordinate transforms, and nodata masking. |
| **xBD Disaster Damage Assessment** | No | Yes | High-performance multi-image footprint intersection, $\Delta H$ collapse calculation, and GeoJSON synthesis. |
| **3D Asset Packaging (GLB, OBJ)** | No | Yes | Server streams binary GLB buffers and pre-packaged ZIP archives to the client. |

---

## 3. Production Deployment Guide

### 3.1 Environment Configuration
To maintain system stability on Windows and avoid drive `C:` exhaustion, the following environment variables are strictly defined in `backend/run_server.py`:

```bash
# PyTorch and Pip cache redirection to drive E:
TORCH_HOME="E:\\torch-cache"
PIP_CACHE_DIR="E:\\pip-cache"
TMP="E:\\tmp"
TEMP="E:\\tmp"

# Trained Model Checkpoint Path
CKPT_PATH="E:\\height-model\\height_v2.pt"

# PROJ Geospatial Database paths
PROJ_LIB="C:\\Users\\himar\\AppData\\Local\\Python\\pythoncore-3.14-64\\Lib\\site-packages\\rasterio\\proj_data"
PROJ_DATA="C:\\Users\\himar\\AppData\\Local\\Python\\pythoncore-3.14-64\\Lib\\site-packages\\rasterio\\proj_data"

# Server Host & Port
HOST="127.0.0.1"
PORT="8000"
```

*Note: No sensitive secrets or private API keys are exposed. Cloud DEM caching functions independently with local fallbacks.*

### 3.2 Linux / Docker Container Deployment
For enterprise cloud deployment (AWS EC2 G5 / Google Cloud A100), the backend packages into an NVIDIA-Docker image:

```dockerfile
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y python3-pip gdal-bin libgdal-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY backend/ /app/backend/
COPY frontend/dist/ /app/frontend/dist/

ENV CKPT_PATH="/models/height_v2.pt"
EXPOSE 8000

CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

---

## 4. API Specification Summary

- `GET  /api/health`: Health status, CUDA availability, loaded checkpoint encoder, and DEM status.
- `GET  /api/samples`: List of bundled benchmark datasets (Jacksonville, Sapporo, Terrascope Metro).
- `POST /api/inspect`: Ingests optical/GeoTIFF image, returns dimensions, GSD, bands, and georeference status.
- `POST /api/reconstruct`: Asynchronous 3D reconstruction pipeline generating GLB, OBJ, GeoJSON, and DSM.
- `GET  /api/scene/{job_id}/probe`: Spot elevation and building identification at any coordinate.
- `POST /api/disaster/assess`: Pre/post-disaster structural change assessment, xBD classification, and debris volume.
- `GET  /api/disaster/history`: List of completed disaster assessments.
- `GET  /api/disaster/export/{id}/{format}`: Download disaster results in GeoJSON or JSON formats.
