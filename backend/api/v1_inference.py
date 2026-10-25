"""
GeoDepth 3D Model Inference API (v1).
Exposes the core Single-Image Height Estimation (SIHE) model as a clean,
production-ready REST API for external developers:

  2D image -> AI prediction -> 3D/height representation with estimated heights -> API response

Endpoints:
  - POST /v1/predict : Upload image and obtain height map prediction & metadata.
  - GET  /v1/predictions/{id}/output : Retrieve prediction artifact (16-bit PNG, GeoTIFF, NPY, JSON).
  - GET  /v1/health  : Health check and model readiness telemetry.
"""

import os
import io
import time
import uuid
import json
from typing import Optional, Dict, Any, List

import numpy as np
import cv2
import tifffile
from fastapi import APIRouter, UploadFile, File, Form, Query, Header, HTTPException, status
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from services.height_estimation.model_adapter import get_height_estimation_model
from services.height_estimation.height_calibration import calibrate_height_raster

router = APIRouter(prefix="/v1", tags=["GeoDepth 3D Inference API"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREDICTIONS_DIR = os.path.join(BASE_DIR, "exports", "predictions")
os.makedirs(PREDICTIONS_DIR, exist_ok=True)

# Maximum upload limit: 50 MB
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"}

# Optional server-side API Key protection
GEODEPTH_API_KEY = os.environ.get("GEODEPTH_API_KEY", "")


def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> bool:
    """
    Lightweight API key verification.
    If GEODEPTH_API_KEY is configured in the environment, verifies the header token.
    If not configured, permits public access for seamless developer prototyping.
    """
    expected_key = os.environ.get("GEODEPTH_API_KEY", GEODEPTH_API_KEY)
    if not expected_key or len(expected_key.strip()) == 0:
        return True  # Public prototyping mode

    token = x_api_key
    if not token and authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    if token != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key. Provide 'X-API-Key' or 'Authorization: Bearer <key>' header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return True


# ==============================================================================
# SCHEMAS
# ==============================================================================

class PredictionInputMeta(BaseModel):
    width: int = Field(..., description="Image width in pixels")
    height: int = Field(..., description="Image height in pixels")
    channels: int = Field(3, description="Color channel count")
    format: str = Field("RGB", description="Decoded color format")
    filename: Optional[str] = Field(None, description="Original uploaded filename")


class PredictionStats(BaseModel):
    min: float = Field(..., description="Minimum height value")
    max: float = Field(..., description="Maximum height value")
    mean: float = Field(..., description="Mean height value")
    std: Optional[float] = Field(None, description="Standard deviation")


class PredictionOutputMeta(BaseModel):
    type: str = Field("dense_height_map", description="Output representation type")
    height_units: str = Field(..., description="Height representation units (relative [0, 1] or meters AGL)")
    is_calibrated: bool = Field(False, description="Whether metric physical scaling has been applied")
    statistics: PredictionStats
    output_url: str = Field(..., description="URL to download full-resolution model output artifact")
    supported_formats: List[str] = Field(
        ["png", "tif", "npy", "json"],
        description="Available artifact export formats for GET /v1/predictions/{id}/output"
    )
    point_grid_preview: Optional[List[List[float]]] = Field(
        None, description="Optional 3D elevation matrix downsampled for quick plotting"
    )


class PredictionResponse(BaseModel):
    prediction_id: str = Field(..., description="Unique prediction UUID")
    status: str = Field("completed", description="Inference status")
    model_version: str = Field("HeightFormer-RS-v1", description="Model architecture & version")
    device: str = Field(..., description="Execution hardware device (cuda or cpu)")
    inference_time_ms: float = Field(..., description="Neural model inference latency in milliseconds")
    input: PredictionInputMeta
    prediction: PredictionOutputMeta


class HealthResponse(BaseModel):
    status: str = Field("healthy", description="API health status")
    model_name: str = Field("HeightFormer-RS-v1", description="Loaded neural model name")
    model_loaded: bool = Field(True, description="Whether weights are cached in memory")
    device: str = Field(..., description="Target hardware device")
    version: str = Field("1.0.0", description="API version")


# ==============================================================================
# ENDPOINTS
# ==============================================================================

@router.get("/health", response_model=HealthResponse)
def get_health():
    """
    Health check endpoint returning model readiness and device telemetry.
    """
    model = get_height_estimation_model()
    return HealthResponse(
        status="healthy",
        model_name="HeightFormer-RS-v1",
        model_loaded=True,
        device=str(model.device),
        version="1.0.0",
    )


@router.post("/predict", response_model=PredictionResponse)
async def predict_height(
    image: UploadFile = File(..., description="2D overhead satellite or aerial image (JPG, PNG, TIFF)"),
    calibrate: bool = Query(
        False,
        description="Whether to calibrate normalized relative heights into estimated metric meters above ground"
    ),
    gsd_m: float = Query(
        0.4,
        ge=0.01,
        le=50.0,
        description="Ground Sampling Distance in meters/pixel (used if calibrate=true, defaults to 0.4m)"
    ),
    return_3d_preview: bool = Query(
        False,
        description="Include a downsampled 32x32 3D elevation matrix inside the JSON response for quick 3D wireframe preview"
    ),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """
    Primary Model Inference Endpoint.
    
    1. Validates input image format and dimensions.
    2. Preprocesses image through neural normalization.
    3. Runs single-image height inference using HeightFormer remote-sensing architecture.
    4. Generates standard 16-bit PNG, GeoTIFF, and NumPy heightmap artifacts.
    5. Returns structured JSON containing metadata, stats, and artifact URLs.
    """
    verify_api_key(x_api_key, authorization)

    # 1. Validate file extension
    filename = image.filename or "input.png"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Supported formats: {sorted(list(SUPPORTED_EXTENSIONS))}"
        )

    # 2. Read file bytes with size guard
    content = await image.read()
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size ({len(content) / (1024*1024):.1f} MB) exceeds maximum 50 MB limit."
        )

    # 3. Decode image to RGB NumPy array
    try:
        if ext in {".tif", ".tiff"}:
            decoded = tifffile.imread(io.BytesIO(content))
            if decoded.ndim == 2:
                rgb_img = cv2.cvtColor(decoded, cv2.COLOR_GRAY2RGB)
            elif decoded.ndim == 3 and decoded.shape[2] >= 3:
                rgb_img = decoded[:, :, :3]
            elif decoded.ndim == 3 and decoded.shape[0] in (3, 4):  # CHW format
                rgb_img = np.transpose(decoded[:3], (1, 2, 0))
            else:
                rgb_img = decoded
        else:
            nparr = np.frombuffer(content, np.uint8)
            bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if bgr is None:
                raise ValueError("Corrupt image data")
            rgb_img = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to decode image: {str(e)}. Please upload a valid uncorrupted image."
        )

    h, w = rgb_img.shape[:2]
    if h < 32 or w < 32:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image dimensions ({w}x{h}) are too small. Minimum supported resolution is 32x32 pixels."
        )

    # 4. Neural Model Inference
    model = get_height_estimation_model()
    t_start = time.time()
    try:
        pred_result = model.predict(rgb_img, gsd_m=gsd_m)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Neural model inference failed: {str(e)}"
        )
    inf_ms = round((time.time() - t_start) * 1000.0, 1)

    raw_raster = pred_result["predicted_raster"]  # float32 [0.0, 1.0]

    # 5. Optional Metric Physical Calibration
    if calibrate:
        calib_out = calibrate_height_raster(raw_raster, gsd_m=gsd_m, nominal_max_height_m=28.0)
        final_raster = calib_out["ndsm_height_agl"].astype(np.float32)
        height_units = "meters_above_ground_level"
        is_calibrated = True
        stats = PredictionStats(
            min=round(float(final_raster.min()), 2),
            max=round(float(final_raster.max()), 2),
            mean=round(float(final_raster.mean()), 2),
            std=round(float(final_raster.std()), 2),
        )
    else:
        final_raster = raw_raster.astype(np.float32)
        height_units = "relative_normalized_0_to_1"
        is_calibrated = False
        stats = PredictionStats(
            min=round(float(final_raster.min()), 4),
            max=round(float(final_raster.max()), 4),
            mean=round(float(final_raster.mean()), 4),
            std=round(float(final_raster.std()), 4),
        )

    # 6. Save Artifacts for Output Retrieval
    prediction_id = f"pred_{uuid.uuid4().hex[:12]}"
    pred_dir = os.path.join(PREDICTIONS_DIR, prediction_id)
    os.makedirs(pred_dir, exist_ok=True)

    # 6a. 16-bit Grayscale PNG heightmap (0 - 65535, standard format for DCC tools, Unity, Unreal Engine)
    norm_for_png = (final_raster - final_raster.min()) / max(float(final_raster.max() - final_raster.min()), 1e-6)
    png_uint16 = (norm_for_png * 65535.0).astype(np.uint16)
    png_path = os.path.join(pred_dir, "heightmap.png")
    cv2.imwrite(png_path, png_uint16)

    # 6b. Float32 GeoTIFF
    tif_path = os.path.join(pred_dir, "heightmap.tif")
    tifffile.imwrite(tif_path, final_raster)

    # 6c. Raw NumPy binary
    npy_path = os.path.join(pred_dir, "heightmap.npy")
    np.save(npy_path, final_raster)

    # 6d. Metadata JSON
    meta_path = os.path.join(pred_dir, "metadata.json")
    meta_dict = {
        "prediction_id": prediction_id,
        "width": w,
        "height": h,
        "height_units": height_units,
        "is_calibrated": is_calibrated,
        "stats": stats.model_dump(),
        "created_at": time.time(),
    }
    with open(meta_path, "w") as f:
        json.dump(meta_dict, f, indent=2)

    # 7. Optional 3D Downsampled Grid for Lightweight API visualization
    point_grid = None
    if return_3d_preview:
        preview_res = cv2.resize(final_raster, (32, 32), interpolation=cv2.INTER_AREA)
        point_grid = [[round(float(val), 2) for val in row] for row in preview_res]

    return PredictionResponse(
        prediction_id=prediction_id,
        status="completed",
        model_version=pred_result.get("model_name", "HeightFormer-RS-v1"),
        device=str(model.device),
        inference_time_ms=inf_ms,
        input=PredictionInputMeta(
            width=w,
            height=h,
            channels=3,
            format="RGB",
            filename=filename,
        ),
        prediction=PredictionOutputMeta(
            type="dense_height_map",
            height_units=height_units,
            is_calibrated=is_calibrated,
            statistics=stats,
            output_url=f"/v1/predictions/{prediction_id}/output",
            supported_formats=["png", "tif", "npy", "json"],
            point_grid_preview=point_grid,
        ),
    )


@router.get("/predictions/{prediction_id}/output")
def get_prediction_output(
    prediction_id: str,
    format: str = Query("png", pattern="^(png|tif|npy|json)$", description="Artifact format: png, tif, npy, or json"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """
    Retrieves the prediction artifact in the requested format:
    - png  : 16-bit high-dynamic-range heightmap image (image/png)
    - tif  : 32-bit float GeoTIFF raster (image/tiff)
    - npy  : Raw NumPy array binary (application/octet-stream)
    - json : Numerical metadata and statistics (application/json)
    """
    verify_api_key(x_api_key, authorization)

    pred_dir = os.path.join(PREDICTIONS_DIR, prediction_id)
    if not os.path.isdir(pred_dir):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prediction '{prediction_id}' was not found or has expired."
        )

    fmt = format.lower()
    if fmt == "png":
        file_path = os.path.join(pred_dir, "heightmap.png")
        if not os.path.exists(file_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PNG artifact missing.")
        return FileResponse(file_path, media_type="image/png", filename=f"{prediction_id}_heightmap.png")

    elif fmt == "tif":
        file_path = os.path.join(pred_dir, "heightmap.tif")
        if not os.path.exists(file_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TIFF artifact missing.")
        return FileResponse(file_path, media_type="image/tiff", filename=f"{prediction_id}_heightmap.tif")

    elif fmt == "npy":
        file_path = os.path.join(pred_dir, "heightmap.npy")
        if not os.path.exists(file_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NPY artifact missing.")
        return FileResponse(file_path, media_type="application/octet-stream", filename=f"{prediction_id}_heightmap.npy")

    elif fmt == "json":
        meta_path = os.path.join(pred_dir, "metadata.json")
        if not os.path.exists(meta_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Metadata missing.")
        with open(meta_path, "r") as f:
            data = json.load(f)
        return JSONResponse(content=data)

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported format '{format}'.")
