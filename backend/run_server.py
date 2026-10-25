import os
import sys

os.environ["TORCH_HOME"] = "E:\\torch-cache"
os.environ["PIP_CACHE_DIR"] = "E:\\pip-cache"
os.environ["TMP"] = "E:\\tmp"
os.environ["TEMP"] = "E:\\tmp"
os.environ["PROJ_LIB"] = "C:\\Users\\himar\\AppData\\Local\\Python\\pythoncore-3.14-64\\Lib\\site-packages\\rasterio\\proj_data"
os.environ["PROJ_DATA"] = "C:\\Users\\himar\\AppData\\Local\\Python\\pythoncore-3.14-64\\Lib\\site-packages\\rasterio\\proj_data"

os.makedirs("E:\\torch-cache", exist_ok=True)
os.makedirs("E:\\tmp", exist_ok=True)

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, log_level="info")
