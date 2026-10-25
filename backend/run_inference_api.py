"""
Standalone Lightweight GeoDepth 3D Model Inference Server.
Runs ONLY the core inference API (POST /v1/predict, GET /v1/predictions/{id}/output, GET /v1/health).
No city studio, no agent37, no frontend required.
"""

import os
import sys
import argparse

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.v1_inference import router as v1_router

app = FastAPI(
    title="GeoDepth 3D Model Inference API",
    version="1.0.0",
    description="Minimal REST API exposing the trained GeoDepth 3D / Single-Image Height Estimation (SIHE) model.",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)


if __name__ == "__main__":
    import uvicorn
    parser = argparse.ArgumentParser(description="Run GeoDepth 3D Inference API Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host interface (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on (default: 8000)")
    args = parser.parse_args()

    print(f"Starting GeoDepth 3D Inference Server on http://{args.host}:{args.port}")
    print(f"Interactive Swagger Documentation: http://{args.host}:{args.port}/docs")
    uvicorn.run(app, host=args.host, port=args.port)
