"""
Vercel Serverless Function entrypoint for TerraScope AI FastAPI backend.
"""
import os
import sys

# Ensure backend directory is in sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
backend_dir = os.path.join(root_dir, "backend")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Set Vercel environment flag
os.environ["VERCEL"] = "1"

try:
    from app import app
except Exception as e:
    import traceback
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI(title="TerraScope AI Fallback")

    @app.get("/api/health")
    def health_error():
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e), "traceback": traceback.format_exc()}
        )

    @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    def catch_all(path_name: str):
        return JSONResponse(
            status_code=500,
            content={"status": "error", "path": path_name, "message": str(e), "traceback": traceback.format_exc()}
        )
