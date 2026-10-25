# Investigation of Model Outputs, Metric Scale Calibration, and Geospatial Geometry

**Project:** Terrascope AI / GeoDepth 3D  
**Author:** Senior Geospatial AI Engineer & Photogrammetry Specialist  
**Evaluated Checkpoint:** `E:\height-model\height_v2.pt`  
**Pipeline Code:** `backend/core/geodepth_pipeline.py` & `backend/core/calibration_engine.py`  

---

## 1. Deep Scientific Answers to the 10 Phase 3 Questions

### Q1: What does the model predict?
The model predicts a **hybrid representation consisting of semantic class logits and normalized height Above Ground Level (nDSM)**.
Specifically:
- It does **not** predict absolute orthometric elevation (meters above sea level / AMSL).
- It does **not** predict camera-frame metric range/depth ($Z$ distance from lens center).
- It predicts:
  1. Pixel-level land-cover category probabilities (Ground, Tree, Building, Road, Water).
  2. Relative vertical displacement above the local bare-earth surface datum:
     $$\text{nDSM}(x, y) = \text{DSM}(x, y) - \text{DEM}(x, y)$$

---

### Q2: What are the output tensor dimensions, resolution, data type, units, and numerical range?
- **Tensor Dimensions**: `[1, 6, H, W]` where $H, W$ match the input image dimensions (or tile size $768 \times 768$ during sliding-window inference).
- **Data Type**: 32-bit floating point (`torch.float32` / `numpy.float32`).
- **Channel Organization**:
  - `Channel 0`: Bare Ground / Unclassified logit (unbounded $\mathbb{R}$).
  - `Channel 1`: Tree Canopy logit (unbounded $\mathbb{R}$).
  - `Channel 2`: Building Footprint logit (unbounded $\mathbb{R}$).
  - `Channel 3`: Road / Paved Surface logit (unbounded $\mathbb{R}$).
  - `Channel 4`: Water Body logit (unbounded $\mathbb{R}$).
  - `Channel 5`: Normalized height regression value ($y_{\text{reg}} \in [0.0, \approx 2.5]$).
- **Physical Units**:
  - Channels 0..4: Dimensionless log-odds.
  - Channel 5: Dimensionless normalized height ratio, convertible to physical meters AGL via the scaling factor $s = 30.0\text{ m}$.

---

### Q3: Are the values normalized between 0 and 1? Where and why?
- **In Training**: The training target was constructed from airborne LiDAR nDSM by dividing the true height in meters by $30.0$:
  $$y_{\text{target}} = \frac{\max(0, H_{\text{LiDAR}})}{30.0}$$
  A typical residential house of $6.0\text{ m}$ height has a target value of $0.20$. High-rise structures of $45\text{ m}$ reach $1.50$.
- **In Model Forward Pass**: The final layer does not apply a rigid Sigmoid clamp; it produces linear continuous activations to prevent gradient saturation on tall structures.
- **In Post-Processing**: The values are bounded at zero using ReLU/maximum:
  $$H_{\text{meters}}(x, y) = \max\left(0.0, \, \text{raw}[5, x, y] \times 30.0\right)$$
- **In Visualization**: To display the heightmap as a PNG colormap (`sihe_vis_{job_id}.png`), values are clipped to $[0, 30.0]$ and rescaled to $[0, 255]$ for 8-bit RGB rendering.

---

### Q4: Is normalization used only for visualization, or does it alter the actual prediction?
Normalization during training was essential for **gradient stabilization** across multi-task loss (combining Cross-Entropy for classes and Smooth L1 Loss for height regression).
However, **normalization is reversed in the pipeline before mesh generation**:
- In `geodepth_pipeline.py` (Line 119):
  `hgt = np.maximum(0.0, raw[5] * self.h_scale)`
- The actual 3D building polygon extrusions and terrain height queries (`/api/scene/{id}/probe`) use the unclipped float32 physical meter values, **not** the 8-bit colormap visualization.

---

### Q5: Can the current output be converted into metres using a justified calibration method?
**Yes.** The model was trained against metric airborne LiDAR rasters where $1.0\text{ unit} = 30.0\text{ meters}$.
When Ground Sampling Distance (GSD) matches the training resolution ($0.35\text{ m/px}$), multiplying by $30.0$ yields direct physical meters AGL.
For non-nominal sensor resolutions, Terrascope AI applies an explicit scale adjustment:
$$H_{\text{calibrated}} = H_{\text{raw}} \times \left(\frac{\text{GSD}_{\text{sensor}}}{\text{GSD}_{\text{train}}}\right)^{\alpha}$$
where $\alpha \approx 1.0$ when resolution normalization resizing is active.
Furthermore, if external ground-truth checkpoints (such as known building heights or reference DEM points) are provided, `MetricCalibrationEngine` performs Theil-Sen robust linear regression:
$$H_{\text{metric}} = a \cdot H_{\text{raw}} + b$$

---

### Q6: Which external reference datasets or measurements are required?
1. **For Height Above Ground (nDSM)**: No external dataset is strictly required for relative building heights if the nominal GSD is known.
2. **For Absolute Elevation Above Sea Level (AMSL)**: A georeferenced bare-earth DEM is required, such as:
   - **Copernicus DEM GLO-30** (global $30\text{ m}$ raster).
   - Local airborne LiDAR DTM.
3. **For Metric Scale Verification**: At least one known distance (e.g. standard athletic track $= 400\text{ m}$, lane width $= 3.5\text{ m}$, kei car length $= 3.4\text{ m}$) or known floor count ($\approx 3.0\text{ m}$ per residential story).

---

### Q7: How are image pixels mapped to geographic coordinates?
Two coordinate systems are maintained:
1. **Mode A: Local Metric Cartesian Frame (Non-georeferenced optical images)**
   - The origin $(0, 0, 0)$ is fixed at the image center:
     $$X_{\text{world}} = (x_{\text{pixel}} - W/2) \times \text{GSD}_m$$
     $$Z_{\text{world}} = (y_{\text{pixel}} - H/2) \times \text{GSD}_m$$
     $$Y_{\text{world}} = \text{Elevation}(x_{\text{pixel}}, y_{\text{pixel}})$$
2. **Mode B: Georeferenced Projected Coordinate System (GeoTIFF)**
   - Uses the GDAL/Rasterio affine transformation matrix $A$:
     $$\begin{bmatrix} X_{\text{proj}} \\ Y_{\text{proj}} \end{bmatrix} = \begin{bmatrix} A_0 & A_1 & A_2 \\ A_3 & A_4 & A_5 \end{bmatrix} \begin{bmatrix} x_{\text{pixel}} \\ y_{\text{pixel}} \\ 1 \end{bmatrix}$$
   - Re-projected into WGS84 (EPSG:4326) via `proj4` for GIS integration.

---

### Q8: What coordinate reference system, horizontal units, vertical datum, and elevation reference are used?
- **Horizontal CRS**: Local UTM projection (e.g., EPSG:32617 for Jacksonville, EPSG:6677 for Sapporo) or Local Metric Cartesian.
- **Horizontal Units**: Meters ($m$).
- **Vertical Datum**: EGM96 / EGM2008 geoid for Copernicus DEM; local bare-earth planar ground datum for SIHE extrusions.
- **Elevation Reference**: Above Ground Level (AGL) for structures; Orthometric Height (AMSL) for terrain.

---

### Q9: Does the output preserve geographic alignment when resized, cropped, or tiled?
**Yes.**
- The sliding-window engine uses overlapping windows ($768 \times 768$ with stride $640$) weighted by a 2D Hanning cosine taper function:
  $$W(x, y) = w(x) \otimes w(y)$$
- Tiled predictions are accumulated into a global accumulation tensor and normalized by the sum of window weights $\sum W(x, y)$, guaranteeing $C^1$ smooth continuity without seam artifacts.
- When an image is resized to match the training GSD ($0.35\text{ m}$), nearest-neighbor interpolation is used for semantic class maps to prevent invalid label blending, and bilinear interpolation is used for continuous height fields.
- Coordinate bounding boxes and polygon vertices are transformed through the exact inverse scale ratio back to the native pixel frame.

---

### Q10: Which outputs are currently used to construct the 3D scene?
1. **`seg == 2` (Building Class)**: Extruded into 3D polygonal wall and roof meshes (`BuildingMeshes.tsx`).
2. **`seg == 1` (Tree Class)**: Extruded as instanced 3D tree models (`VegetationObjects.tsx`).
3. **`seg == 3` (Road Class)**: Centerlines vectorized into a terrain-conforming ribbon surface (`RoadNetwork.tsx`).
4. **`hgt` (nDSM Raster)**: Sets the vertical extrusion height for every building, sampled across the polygon footprint.
5. **Photo-Sampled Roof Color**: Median RGB sampled from the optical image inside the building mask, assigned to Three.js `MeshStandardMaterial`.

---

## 2. Rigorous Distinction Between Elevation Concepts

```
              [ Roof Surface (DSM) ]
                     │
                     │  <── Building Height (nDSM) = DSM - DEM
                     │      Predicted by ResNet50 U-Net Checkpoint
                     ▼
  ════════════[ Bare Ground Surface (DEM) ]════════════  (Copernicus GLO-30)
                     │
                     │  <── Terrain Elevation Above Sea Level
                     │      (Requires external Geoid / Datum reference)
                     ▼
~~~~~~~~~~~~~~~~~[ Mean Sea Level (EGM2008 Datum) ]~~~~~~~~~~~~~~~~~
```

1. **Relative Depth ($d_{\text{rel}}$)**: Monocular ordering from computer vision models (e.g. MiDaS, Depth Anything). Unitless, inverse, ungrounded. *Never treat as meters.*
2. **Metric Range ($Z_{\text{cam}}$)**: Euclidean distance from camera optical center along line of sight. Depends on camera focal length and altitude.
3. **Bare-Earth Terrain Elevation (DEM/DTM)**: Altitude of the bare ground surface excluding buildings and trees, measured relative to a vertical datum (e.g. WGS84 ellipsoid or EGM96 geoid).
4. **Digital Surface Model (DSM)**: Altitude of the uppermost surface (roofs, treetops, bare ground) relative to the vertical datum.
5. **Height Above Ground (nDSM)**: The vertical differential:
   $$\text{nDSM} = \text{DSM} - \text{DEM}$$
   This is the exact metric physical quantity estimated by Terrascope AI.

---

## 3. Why Copernicus DEM (30m) Cannot Validate Building Heights

A critical scientific constraint must be maintained:

> **Copernicus DEM GLO-30 has a spatial resolution of $30\text{ meters per pixel}$.**  
> An average urban residential house has footprint dimensions of $10\text{ m} \times 12\text{ m}$. A single Copernicus pixel covers an area of $900\text{ m}^2$, averaging nine entire house plots, backyards, and streets into a single elevation scalar.

Therefore:
- Copernicus DEM is suitable for **regional terrain slope, watershed drainage basins, and base elevation datum**.
- Copernicus DEM **CANNOT independently resolve, validate, or measure individual building heights or roof structures**.
- Any system claiming to "verify building heights with Copernicus 30m DEM" is scientifically flawed and fabricating precision.
- Building-level height validation requires high-resolution airborne LiDAR (e.g., USGS 3DEP, DFC2019) or multi-view stereoscopic photogrammetry ($<0.5\text{ m}$ GSD).
