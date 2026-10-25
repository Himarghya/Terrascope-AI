import os
import cv2
import numpy as np
import math
import sys
sys.path.append(os.path.join(os.getcwd(), "backend"))

from core.geodepth_pipeline import GeoDepthPipeline

def fit_predominant_building_shape(contour: np.ndarray, gsd_m: float = 0.35):
    """
    Determines the predominant geometric shape of the building and fits a clean,
    architecturally regularized polygon (Rectangle OBB, Orthogonal L/T-Shape, or Simplified Polygon).
    """
    area_px = cv2.contourArea(contour)
    if area_px < 6:
        return None, "Invalid", 0.0

    rect = cv2.minAreaRect(contour)
    (cx, cy), (rw, rh), angle = rect
    if rw < rh:
        rw, rh = rh, rw
        angle = (angle + 90) % 180

    rect_area = max(rw * rh, 1.0)
    rectangularity = area_px / rect_area
    area_m2 = area_px * (gsd_m ** 2)

    # Predominantly Rectangular: single-family houses, villas, flat blocks
    if rectangularity >= 0.58 or (area_m2 <= 300.0 and rectangularity >= 0.50):
        poly = cv2.boxPoints(((cx, cy), (rw, rh), angle))
        return poly, "Rectangle / Box", 0.95

    # L-Shape / T-Shape / Orthogonal Stepped Building
    # Rotate contour into principal frame by -angle
    angle_rad = math.radians(angle)
    cos_a = math.cos(-angle_rad)
    sin_a = math.sin(-angle_rad)

    pts = contour.reshape(-1, 2).astype(np.float32)
    # Center points
    pts_centered = pts - np.array([cx, cy])
    # Rotate
    pts_rot = np.empty_like(pts_centered)
    pts_rot[:, 0] = pts_centered[:, 0] * cos_a - pts_centered[:, 1] * sin_a
    pts_rot[:, 1] = pts_centered[:, 0] * sin_a + pts_centered[:, 1] * cos_a

    # Douglas-Peucker simplification in aligned frame
    cnt_rot = pts_rot.reshape(-1, 1, 2).astype(np.int32)
    peri = cv2.arcLength(cnt_rot, True)
    epsilon = max(1.5, 0.025 * peri)
    approx_rot = cv2.approxPolyDP(cnt_rot, epsilon, True).reshape(-1, 2).astype(np.float32)

    if len(approx_rot) >= 4:
        # Rotate back
        cos_back = math.cos(angle_rad)
        sin_back = math.sin(angle_rad)
        poly_back = np.empty_like(approx_rot)
        poly_back[:, 0] = approx_rot[:, 0] * cos_back - approx_rot[:, 1] * sin_back + cx
        poly_back[:, 1] = approx_rot[:, 0] * sin_back + approx_rot[:, 1] * cos_back + cy
        return poly_back, "Orthogonal L/T-Shape", 0.90

    # Fallback bounding box
    poly = cv2.boxPoints(((cx, cy), (rw, rh), angle))
    return poly, "Rectangle / Box", 0.85

print("Fit function defined successfully")
