"""
Sample Dataset Generator for Satellite-to-3D Reconstruction.
Synthesizes high-resolution, spectrally and geometrically realistic aerial/satellite scenes
with calibrated shadows, building structures, vegetation crowns, roads, and water.
"""

import os
import math
from typing import Dict, Any, List
import numpy as np
import cv2
from PIL import Image


def create_suburban_residential_sample(file_path: str) -> str:
    """
    Synthesizes a realistic 1024x1024 high-resolution aerial scene of a suburban neighborhood:
    - Asphalt road network with cul-de-sac
    - Gabled and hipped residential houses with terracotta and composite roofs
    - Front/back lawns with realistic ExG spectral signatures
    - Mature deciduous and coniferous trees with cellular canopy texture
    - Retention pond with natural water reflectance
    - Solar cast shadows pointing toward North-West (Solar Azimuth = 135 deg SE, Elevation = 45 deg)
    """
    h, w = 1024, 1024
    img = np.zeros((h, w, 3), dtype=np.uint8)

    # 1. Base terrain / ground (warm sandy loam + natural texture)
    base_earth = np.random.normal(140, 10, (h, w)).clip(100, 180).astype(np.uint8)
    img[:, :, 0] = (base_earth * 1.05).clip(0, 255).astype(np.uint8)
    img[:, :, 1] = (base_earth * 0.95).clip(0, 255).astype(np.uint8)
    img[:, :, 2] = (base_earth * 0.75).clip(0, 255).astype(np.uint8)

    # 2. Grass lawns (Vibrant green, high ExG)
    # Define residential parcel zones
    lawn_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.rectangle(lawn_mask, (60, 60), (450, 420), 255, -1)
    cv2.rectangle(lawn_mask, (560, 60), (960, 420), 255, -1)
    cv2.rectangle(lawn_mask, (60, 560), (450, 960), 255, -1)
    cv2.rectangle(lawn_mask, (560, 560), (960, 960), 255, -1)

    grass_texture = np.random.normal(0, 8, (h, w))
    r_g = np.clip(85 + grass_texture, 40, 130).astype(np.uint8)
    g_g = np.clip(160 + grass_texture, 110, 210).astype(np.uint8)
    b_g = np.clip(60 + grass_texture, 30, 100).astype(np.uint8)

    img[lawn_mask > 0, 0] = r_g[lawn_mask > 0]
    img[lawn_mask > 0, 1] = g_g[lawn_mask > 0]
    img[lawn_mask > 0, 2] = b_g[lawn_mask > 0]

    # 3. Retention Pond / Water body in top-right corner
    water_pts = np.array([[780, 80], [940, 90], [970, 220], [860, 260], [760, 190]], np.int32)
    cv2.fillPoly(img, [water_pts], (42, 105, 168))
    # Soft water ripples
    water_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(water_mask, [water_pts], 255)
    n_water = int(np.sum(water_mask > 0))
    ripple = (np.random.normal(0, 4, n_water)).astype(np.int16)
    img[water_mask > 0, 0] = np.clip(img[water_mask > 0, 0].astype(np.int16) + ripple, 20, 180).astype(np.uint8)

    # 4. Asphalt Road Network
    # Main North-South road with East-West cul-de-sac branches
    road_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.rectangle(road_mask, (460, 0), (540, 1024), 255, -1)  # Central N-S boulevard
    cv2.rectangle(road_mask, (0, 460), (1024, 540), 255, -1)  # Central E-W avenue
    # Cul-de-sac circles
    cv2.circle(road_mask, (500, 500), 75, 255, -1)

    road_noise = np.random.normal(70, 5, (h, w)).clip(55, 90).astype(np.uint8)
    img[road_mask > 0, 0] = road_noise[road_mask > 0]
    img[road_mask > 0, 1] = (road_noise[road_mask > 0] * 1.02).astype(np.uint8)
    img[road_mask > 0, 2] = (road_noise[road_mask > 0] * 1.05).astype(np.uint8)

    # White and yellow road markings
    cv2.line(img, (500, 10), (500, 420), (220, 220, 220), 2)
    cv2.line(img, (500, 580), (500, 1010), (220, 220, 220), 2)
    cv2.line(img, (10, 500), (420, 500), (220, 180, 20), 2)
    cv2.line(img, (580, 500), (1010, 500), (220, 180, 20), 2)

    # Solar Shadow Vector: Sun at 135 deg (SE), shadows cast towards NW (-1, -1)
    # dx = -14px, dy = -14px for 1-2 story house (~6m at 0.4m/px = 15px)
    def draw_shadow(contour, shadow_len_px=18):
        # Shift contour along NW vector
        pts_shifted = contour - np.array([int(shadow_len_px * 0.707), int(shadow_len_px * 0.707)])
        # Shadow polygon by hulling base and shifted
        combined = np.vstack([contour, pts_shifted])
        hull = cv2.convexHull(combined)
        # Draw transparent dark shadow
        shadow_layer = img.copy()
        cv2.fillPoly(shadow_layer, [hull], (18, 22, 28))
        cv2.addWeighted(shadow_layer, 0.75, img, 0.25, 0, img)

    # 5. Houses / Buildings
    houses = [
        # Northwest quadrant
        {"rect": (120, 110, 110, 80), "roof": "gabled", "color": (195, 85, 55), "height_m": 6.8},
        {"rect": (280, 120, 130, 90), "roof": "hipped", "color": (80, 82, 88), "height_m": 7.5},
        {"rect": (130, 270, 120, 85), "roof": "gabled", "color": (210, 95, 60), "height_m": 6.2},
        {"rect": (290, 280, 105, 95), "roof": "flat", "color": (215, 215, 220), "height_m": 8.4},

        # Northeast quadrant
        {"rect": (600, 120, 125, 85), "roof": "gabled", "color": (185, 75, 45), "height_m": 6.5},
        {"rect": (620, 280, 135, 95), "roof": "hipped", "color": (65, 70, 75), "height_m": 7.8},

        # Southwest quadrant
        {"rect": (110, 620, 130, 90), "roof": "gabled", "color": (190, 80, 50), "height_m": 7.0},
        {"rect": (270, 610, 120, 85), "roof": "flat", "color": (190, 192, 198), "height_m": 8.0},
        {"rect": (120, 780, 115, 95), "roof": "hipped", "color": (205, 90, 55), "height_m": 6.6},
        {"rect": (280, 770, 140, 100), "roof": "gabled", "color": (75, 78, 85), "height_m": 7.2},

        # Southeast quadrant
        {"rect": (610, 620, 140, 95), "roof": "gabled", "color": (200, 88, 52), "height_m": 7.4},
        {"rect": (780, 630, 130, 85), "roof": "hipped", "color": (180, 70, 40), "height_m": 6.5},
        {"rect": (620, 790, 125, 90), "roof": "flat", "color": (220, 220, 225), "height_m": 9.0},
        {"rect": (790, 780, 135, 100), "roof": "gabled", "color": (195, 82, 48), "height_m": 7.1},
    ]

    # Draw shadows first, then houses on top
    for h_info in houses:
        x, y, w_box, h_box = h_info["rect"]
        pts = np.array([[x, y], [x + w_box, y], [x + w_box, y + h_box], [x, y + h_box]], np.int32)
        shadow_len = int(h_info["height_m"] / 0.4)
        draw_shadow(pts, shadow_len)

    # Draw building footprints & roof facets
    for h_info in houses:
        x, y, w_box, h_box = h_info["rect"]
        color = h_info["color"]
        roof_type = h_info["roof"]

        # House footprint
        cv2.rectangle(img, (x, y), (x + w_box, y + h_box), color, -1)

        # Roof details
        if roof_type == "gabled":
            # Ridge line across center
            mid_y = y + h_box // 2
            # Bright slope vs shaded slope
            cv2.rectangle(img, (x, y), (x + w_box, mid_y), (min(255, color[0] + 25), min(255, color[1] + 25), min(255, color[2] + 25)), -1)
            cv2.rectangle(img, (x, mid_y), (x + w_box, y + h_box), (max(0, color[0] - 25), max(0, color[1] - 25), max(0, color[2] - 25)), -1)
            cv2.line(img, (x, mid_y), (x + w_box, mid_y), (240, 240, 240), 2)
        elif roof_type == "hipped":
            # Triangular facets
            cx, cy = x + w_box // 2, y + h_box // 2
            cv2.line(img, (x, y), (cx, cy), (230, 230, 230), 2)
            cv2.line(img, (x + w_box, y), (cx, cy), (230, 230, 230), 2)
            cv2.line(img, (x + w_box, y + h_box), (cx, cy), (230, 230, 230), 2)
            cv2.line(img, (x, y + h_box), (cx, cy), (230, 230, 230), 2)
        elif roof_type == "flat":
            # Parapet rim
            cv2.rectangle(img, (x, y), (x + w_box, y + h_box), (max(0, color[0] - 40), max(0, color[1] - 40), max(0, color[2] - 40)), 3)
            # Rooftop HVAC units
            cv2.rectangle(img, (x + 20, y + 20), (x + 35, y + 32), (60, 60, 65), -1)
            cv2.rectangle(img, (x + 55, y + 25), (x + 75, y + 45), (45, 55, 75), -1)

    # 6. Trees and Vegetation (Canopy crowns with shadows)
    trees = [
        # Around houses and roadside
        {"cx": 90, "cy": 90, "r": 18, "type": "broadleaf"},
        {"cx": 250, "cy": 85, "r": 22, "type": "broadleaf"},
        {"cx": 420, "cy": 95, "r": 16, "type": "conifer"},
        {"cx": 85, "cy": 250, "r": 20, "type": "broadleaf"},
        {"cx": 435, "cy": 260, "r": 24, "type": "broadleaf"},
        {"cx": 85, "cy": 400, "r": 17, "type": "conifer"},
        {"cx": 250, "cy": 410, "r": 21, "type": "broadleaf"},
        {"cx": 425, "cy": 405, "r": 19, "type": "broadleaf"},

        # Along pond edge
        {"cx": 750, "cy": 120, "r": 20, "type": "broadleaf"},
        {"cx": 730, "cy": 175, "r": 23, "type": "broadleaf"},
        {"cx": 880, "cy": 285, "r": 18, "type": "broadleaf"},
        {"cx": 955, "cy": 250, "r": 15, "type": "palm"},

        # South zones
        {"cx": 80, "cy": 600, "r": 20, "type": "broadleaf"},
        {"cx": 430, "cy": 600, "r": 25, "type": "broadleaf"},
        {"cx": 240, "cy": 740, "r": 18, "type": "conifer"},
        {"cx": 85, "cy": 760, "r": 22, "type": "broadleaf"},
        {"cx": 435, "cy": 760, "r": 21, "type": "broadleaf"},
        {"cx": 85, "cy": 920, "r": 19, "type": "conifer"},
        {"cx": 250, "cy": 925, "r": 23, "type": "broadleaf"},
        {"cx": 430, "cy": 930, "r": 20, "type": "broadleaf"},

        # East South
        {"cx": 590, "cy": 600, "r": 19, "type": "broadleaf"},
        {"cx": 760, "cy": 605, "r": 22, "type": "broadleaf"},
        {"cx": 940, "cy": 615, "r": 17, "type": "conifer"},
        {"cx": 760, "cy": 750, "r": 24, "type": "broadleaf"},
        {"cx": 945, "cy": 760, "r": 19, "type": "broadleaf"},
        {"cx": 595, "cy": 920, "r": 20, "type": "palm"},
        {"cx": 765, "cy": 925, "r": 23, "type": "broadleaf"},
        {"cx": 940, "cy": 930, "r": 21, "type": "conifer"},
    ]

    for t in trees:
        cx, cy, r_crown = t["cx"], t["cy"], t["r"]
        # Tree shadow (NW)
        sh_cx, sh_cy = int(cx - r_crown * 0.9), int(cy - r_crown * 0.9)
        cv2.circle(img, (sh_cx, sh_cy), int(r_crown * 0.9), (20, 24, 28), -1)

    for t in trees:
        cx, cy, r_crown = t["cx"], t["cy"], t["r"]
        ttype = t["type"]

        if ttype == "conifer":
            crown_color = (25, 85, 35)
        elif ttype == "palm":
            crown_color = (65, 145, 30)
        else:  # broadleaf
            crown_color = (35, 125, 45)

        # Crown circle
        cv2.circle(img, (cx, cy), r_crown, crown_color, -1)
        # Cellular foliage texture
        cv2.circle(img, (cx - 2, cy - 2), int(r_crown * 0.7), (min(255, crown_color[0] + 25), min(255, crown_color[1] + 30), min(255, crown_color[2] + 20)), -1)
        cv2.circle(img, (cx + 3, cy + 3), int(r_crown * 0.5), (max(0, crown_color[0] - 20), max(0, crown_color[1] - 20), max(0, crown_color[2] - 15)), -1)

    # Save to file
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    Image.fromarray(img).save(file_path, quality=95)
    return file_path


def create_urban_highrise_sample(file_path: str) -> str:
    """
    Synthesizes an urban commercial downtown satellite scene:
    - Multi-story office towers with complex stepped roof profiles
    - Rooftop mechanical penthouses, chillers, and solar arrays
    - Wide 4-lane avenues with crosswalks
    - Linear urban plaza with tree planters
    """
    h, w = 1024, 1024
    img = np.zeros((h, w, 3), dtype=np.uint8)

    # Concrete plaza ground
    plaza_noise = np.random.normal(160, 8, (h, w)).clip(130, 195).astype(np.uint8)
    img[:, :, 0] = plaza_noise
    img[:, :, 1] = plaza_noise
    img[:, :, 2] = (plaza_noise * 1.02).clip(0, 255).astype(np.uint8)

    # Wide boulevard grid
    road_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.rectangle(road_mask, (0, 440), (1024, 580), 255, -1)
    cv2.rectangle(road_mask, (440, 0), (580, 1024), 255, -1)

    asphalt = np.random.normal(65, 4, (h, w)).clip(50, 85).astype(np.uint8)
    img[road_mask > 0, 0] = asphalt[road_mask > 0]
    img[road_mask > 0, 1] = asphalt[road_mask > 0]
    img[road_mask > 0, 2] = (asphalt[road_mask > 0] * 1.05).astype(np.uint8)

    # Highrise buildings with significant heights (15m to 45m -> shadow length 35px to 90px)
    highrises = [
        {"rect": (80, 80, 280, 280), "height_m": 42.0, "color": (210, 215, 225)},
        {"rect": (640, 90, 290, 270), "height_m": 35.0, "color": (195, 200, 205)},
        {"rect": (90, 640, 270, 280), "height_m": 48.0, "color": (70, 90, 120)}, # Glass curtain wall
        {"rect": (650, 650, 280, 280), "height_m": 38.0, "color": (185, 190, 195)},
    ]

    for b in highrises:
        x, y, bw, bh = b["rect"]
        sh_len = int(b["height_m"] / 0.4)
        # Deep cast shadow
        pts = np.array([[x, y], [x + bw, y], [x + bw, y + bh], [x, y + bh]], np.int32)
        pts_sh = pts - np.array([int(sh_len * 0.707), int(sh_len * 0.707)])
        combined = np.vstack([pts, pts_sh])
        hull = cv2.convexHull(combined)
        cv2.fillPoly(img, [hull], (12, 15, 22))

    for b in highrises:
        x, y, bw, bh = b["rect"]
        color = b["color"]
        # Main roof
        cv2.rectangle(img, (x, y), (x + bw, y + bh), color, -1)
        # Parapet border
        cv2.rectangle(img, (x, y), (x + bw, y + bh), (max(0, color[0]-35), max(0, color[1]-35), max(0, color[2]-35)), 4)
        # Stepped mechanical roof level
        mx, my, mw, mh = x + bw//4, y + bh//4, bw//2, bh//2
        cv2.rectangle(img, (mx, my), (mx + mw, my + mh), (max(0, color[0]-20), max(0, color[1]-20), max(0, color[2]-20)), -1)
        # HVAC units & solar panels
        for u_x in range(mx + 15, mx + mw - 20, 35):
            for u_y in range(my + 15, my + mh - 20, 35):
                cv2.rectangle(img, (u_x, u_y), (u_x + 22, u_y + 18), (40, 50, 70), -1)

    # Plaza trees along sidewalks
    for tx in range(60, 420, 60):
        cv2.circle(img, (tx, 410), 16, (30, 115, 40), -1)
        cv2.circle(img, (tx, 610), 16, (30, 115, 40), -1)
    for ty in range(60, 420, 60):
        cv2.circle(img, (410, ty), 16, (30, 115, 40), -1)
        cv2.circle(img, (610, ty), 16, (30, 115, 40), -1)

    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    Image.fromarray(img).save(file_path, quality=95)
    return file_path


def create_terrascope_metro_complex_sample(file_path: str) -> str:
    """
    Synthesizes the comprehensive TERRASCOPE AI benchmark dataset:
    A high-resolution 1024x1024 scene containing 28 distinct buildings across 4 typologies:
    - 8 residential houses with gabled & hipped roofs (B001 - B008, 5.5m - 7.8m)
    - 4 multi-family apartment blocks with HVAC & balconies (B009 - B012, 11.8m - 15.2m)
    - 4 commercial corporate campus facilities with L-shape & U-shape courtyards (B013 - B016, 11.5m - 18.0m)
    - 4 civic and institutional campus facilities (B017 - B020, 9.8m - 15.0m)
    - 4 industrial distribution warehouses with linear pitched roofs (B021 - B024, 8.8m - 11.0m)
    - 4 high-rise commercial towers with stepped mechanical penthouses (B025 - B028, 27.5m - 44.5m)
    Includes dual-lane arterial avenues, white striping, retention pond, and 35+ trees.
    Solar shadows cast toward North-West with length exactly proportional to height.
    """
    h, w = 1024, 1024
    img = np.zeros((h, w, 3), dtype=np.uint8)

    # 1. Base terrain soil
    base_earth = np.random.normal(138, 8, (h, w)).clip(100, 175).astype(np.uint8)
    img[:, :, 0] = (base_earth * 1.05).clip(0, 255).astype(np.uint8)
    img[:, :, 1] = (base_earth * 0.96).clip(0, 255).astype(np.uint8)
    img[:, :, 2] = (base_earth * 0.76).clip(0, 255).astype(np.uint8)

    # 2. Lawns & Landscape greenery
    lawn_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.rectangle(lawn_mask, (40, 40), (460, 460), 255, -1)
    cv2.rectangle(lawn_mask, (560, 40), (980, 460), 255, -1)
    cv2.rectangle(lawn_mask, (40, 560), (460, 980), 255, -1)
    cv2.rectangle(lawn_mask, (560, 560), (980, 980), 255, -1)

    grass_noise = np.random.normal(0, 6, (h, w))
    img[lawn_mask > 0, 0] = np.clip(80 + grass_noise[lawn_mask > 0], 35, 125).astype(np.uint8)
    img[lawn_mask > 0, 1] = np.clip(155 + grass_noise[lawn_mask > 0], 105, 205).astype(np.uint8)
    img[lawn_mask > 0, 2] = np.clip(55 + grass_noise[lawn_mask > 0], 25, 95).astype(np.uint8)

    # 3. Water body (retention basin in top-right)
    water_pts = np.array([[780, 60], [960, 70], [970, 210], [860, 240], [760, 170]], np.int32)
    cv2.fillPoly(img, [water_pts], (40, 105, 170))
    water_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(water_mask, [water_pts], 255)
    ripple = (np.random.normal(0, 4, int(np.sum(water_mask > 0)))).astype(np.int16)
    img[water_mask > 0, 0] = np.clip(img[water_mask > 0, 0].astype(np.int16) + ripple, 20, 180).astype(np.uint8)

    # 4. Road network (arterial boulevard + cross streets)
    road_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.rectangle(road_mask, (480, 0), (544, 1024), 255, -1)  # N-S Boulevard
    cv2.rectangle(road_mask, (0, 480), (1024, 544), 255, -1)  # E-W Avenue
    cv2.rectangle(road_mask, (0, 240), (480, 276), 255, -1)
    cv2.rectangle(road_mask, (544, 240), (1024, 276), 255, -1)
    cv2.rectangle(road_mask, (0, 750), (480, 786), 255, -1)
    cv2.rectangle(road_mask, (544, 750), (1024, 786), 255, -1)
    cv2.rectangle(road_mask, (240, 0), (276, 1024), 255, -1)
    cv2.rectangle(road_mask, (750, 0), (786, 1024), 255, -1)

    asphalt = np.random.normal(68, 5, (h, w)).clip(50, 88).astype(np.uint8)
    img[road_mask > 0, 0] = asphalt[road_mask > 0]
    img[road_mask > 0, 1] = (asphalt[road_mask > 0] * 1.02).astype(np.uint8)
    img[road_mask > 0, 2] = (asphalt[road_mask > 0] * 1.06).astype(np.uint8)

    # White lane markings
    for cy in [120, 380, 640, 890]:
        cv2.line(img, (512, cy - 30), (512, cy + 30), (230, 230, 230), 2)
        cv2.line(img, (cy - 30, 512), (cy + 30, 512), (230, 230, 230), 2)

    def draw_shadow(contour, shadow_len_px=18):
        pts_shifted = contour - np.array([int(shadow_len_px * 0.707), int(shadow_len_px * 0.707)])
        combined = np.vstack([contour, pts_shifted])
        hull = cv2.convexHull(combined)
        shadow_layer = img.copy()
        cv2.fillPoly(shadow_layer, [hull], (16, 20, 26))
        cv2.addWeighted(shadow_layer, 0.75, img, 0.25, 0, img)

    # 28 Buildings across 4 quadrants
    buildings = [
        # --- NW QUADRANT: 8 Residential Houses (B001 - B008) ---
        {"rect": (60, 60, 75, 60), "roof": "gabled", "color": (195, 82, 52), "height_m": 6.2},
        {"rect": (155, 65, 70, 65), "roof": "hipped", "color": (75, 80, 88), "height_m": 6.8},
        {"rect": (60, 145, 80, 60), "roof": "gabled", "color": (210, 95, 60), "height_m": 5.9},
        {"rect": (155, 150, 72, 62), "roof": "hipped", "color": (185, 75, 45), "height_m": 7.1},
        {"rect": (295, 60, 75, 65), "roof": "gabled", "color": (190, 80, 50), "height_m": 6.5},
        {"rect": (390, 65, 70, 60), "roof": "flat", "color": (220, 222, 225), "height_m": 7.8},
        {"rect": (295, 150, 80, 65), "roof": "hipped", "color": (70, 75, 82), "height_m": 6.7},
        {"rect": (390, 145, 75, 70), "roof": "gabled", "color": (205, 90, 55), "height_m": 6.4},

        # --- NE QUADRANT: 4 Multi-Family Residential / Apartments (B009 - B012) ---
        {"rect": (565, 70, 115, 75), "roof": "flat", "color": (215, 218, 222), "height_m": 13.8},
        {"rect": (565, 165, 120, 80), "roof": "flat", "color": (200, 204, 210), "height_m": 15.2},
        {"rect": (805, 290, 125, 85), "roof": "hipped", "color": (68, 72, 80), "height_m": 12.4},
        {"rect": (665, 290, 120, 80), "roof": "flat", "color": (225, 225, 230), "height_m": 14.6},

        # --- SW QUADRANT: 4 Commercial Corporate Campus + 4 Institutional (B013 - B020) ---
        {"poly": [[60, 295], [175, 295], [175, 360], [125, 360], [125, 420], [60, 420]], "roof": "flat", "color": (210, 215, 220), "height_m": 16.5},
        {"poly": [[295, 295], [440, 295], [440, 420], [395, 420], [395, 350], [340, 350], [340, 420], [295, 420]], "roof": "flat", "color": (195, 200, 205), "height_m": 18.0},
        {"rect": (60, 580, 125, 85), "roof": "flat", "color": (205, 210, 215), "height_m": 14.2},
        {"rect": (205, 585, 110, 80), "roof": "gabled", "color": (180, 75, 45), "height_m": 11.5},
        {"rect": (60, 685, 120, 85), "roof": "flat", "color": (225, 225, 230), "height_m": 12.8},
        {"rect": (205, 685, 115, 85), "roof": "hipped", "color": (65, 70, 78), "height_m": 13.5},
        {"rect": (60, 805, 130, 90), "roof": "flat", "color": (215, 218, 224), "height_m": 15.0},
        {"rect": (205, 810, 115, 85), "roof": "flat", "color": (210, 212, 218), "height_m": 10.2},

        # --- SE QUADRANT: 4 Industrial Logistics + 4 High-Rise Towers (B021 - B028) ---
        {"rect": (565, 580, 160, 75), "roof": "linear_gabled", "color": (175, 180, 185), "height_m": 9.4},
        {"rect": (745, 580, 155, 80), "roof": "linear_gabled", "color": (180, 185, 190), "height_m": 10.2},
        {"rect": (565, 675, 155, 75), "roof": "linear_gabled", "color": (170, 175, 182), "height_m": 8.8},
        {"rect": (745, 675, 160, 80), "roof": "linear_gabled", "color": (185, 188, 192), "height_m": 11.0},
        {"rect": (565, 805, 110, 110), "roof": "stepped_highrise", "color": (210, 215, 225), "height_m": 38.0},
        {"rect": (695, 805, 105, 105), "roof": "stepped_highrise", "color": (65, 85, 115), "height_m": 44.5},
        {"rect": (820, 805, 100, 100), "roof": "stepped_highrise", "color": (195, 200, 208), "height_m": 32.5},
        {"rect": (695, 925, 105, 85), "roof": "stepped_highrise", "color": (180, 185, 192), "height_m": 27.5},
    ]

    # Draw shadows first
    for b in buildings:
        sh_len = int(b["height_m"] / 0.4)
        if "poly" in b:
            pts = np.array(b["poly"], np.int32)
        else:
            x, y, bw, bh = b["rect"]
            pts = np.array([[x, y], [x + bw, y], [x + bw, y + bh], [x, y + bh]], np.int32)
        draw_shadow(pts, sh_len)

    # Draw building footprints & roof textures
    for b in buildings:
        color = b["color"]
        roof = b["roof"]

        if "poly" in b:
            pts = np.array(b["poly"], np.int32)
            cv2.fillPoly(img, [pts], color)
            cv2.polylines(img, [pts], True, (max(0, color[0] - 35), max(0, color[1] - 35), max(0, color[2] - 35)), 2)
        else:
            x, y, bw, bh = b["rect"]
            cv2.rectangle(img, (x, y), (x + bw, y + bh), color, -1)

            if roof == "gabled":
                mid_y = y + bh // 2
                cv2.rectangle(img, (x, y), (x + bw, mid_y), (min(255, color[0] + 25), min(255, color[1] + 25), min(255, color[2] + 25)), -1)
                cv2.rectangle(img, (x, mid_y), (x + bw, y + bh), (max(0, color[0] - 25), max(0, color[1] - 25), max(0, color[2] - 25)), -1)
                cv2.line(img, (x, mid_y), (x + bw, mid_y), (235, 235, 235), 2)
            elif roof == "hipped":
                cx, cy = x + bw // 2, y + bh // 2
                cv2.line(img, (x, y), (cx, cy), (230, 230, 230), 2)
                cv2.line(img, (x + bw, y), (cx, cy), (230, 230, 230), 2)
                cv2.line(img, (x + bw, y + bh), (cx, cy), (230, 230, 230), 2)
                cv2.line(img, (x, y + bh), (cx, cy), (230, 230, 230), 2)
            elif roof == "linear_gabled":
                mid_y = y + bh // 2
                cv2.line(img, (x, mid_y), (x + bw, mid_y), (240, 240, 240), 2)
                for gx in range(x + 20, x + bw - 20, 25):
                    cv2.rectangle(img, (gx, mid_y - 8), (gx + 12, mid_y + 8), (50, 60, 75), -1)
            elif roof == "stepped_highrise":
                cv2.rectangle(img, (x, y), (x + bw, y + bh), (max(0, color[0] - 30), max(0, color[1] - 30), max(0, color[2] - 30)), 3)
                mx, my, mw, mh = x + bw // 4, y + bh // 4, bw // 2, bh // 2
                cv2.rectangle(img, (mx, my), (mx + mw, my + mh), (max(0, color[0] - 15), max(0, color[1] - 15), max(0, color[2] - 15)), -1)
                for u_x in range(mx + 10, mx + mw - 10, 25):
                    for u_y in range(my + 10, my + mh - 10, 25):
                        cv2.rectangle(img, (u_x, u_y), (u_x + 15, u_y + 12), (35, 45, 60), -1)
            else:  # Flat roof with parapet
                cv2.rectangle(img, (x, y), (x + bw, y + bh), (max(0, color[0] - 30), max(0, color[1] - 30), max(0, color[2] - 30)), 2)
                cv2.rectangle(img, (x + 15, y + 15), (x + 30, y + 25), (55, 55, 60), -1)

    # 5. Trees along corridors (35+ trees)
    trees_coords = [
        # Residential roads
        (45, 125, 14, "broadleaf"), (140, 125, 16, "broadleaf"), (245, 125, 15, "conifer"), (375, 125, 16, "broadleaf"),
        (45, 225, 15, "broadleaf"), (140, 225, 17, "broadleaf"), (245, 225, 14, "conifer"), (375, 225, 16, "broadleaf"),
        # Boulevard & Plaza
        (465, 80, 16, "broadleaf"), (465, 160, 18, "broadleaf"), (465, 340, 16, "conifer"), (465, 420, 17, "broadleaf"),
        (555, 80, 17, "broadleaf"), (555, 160, 16, "broadleaf"), (555, 340, 18, "broadleaf"), (555, 420, 16, "conifer"),
        # Lake bank
        (750, 90, 18, "broadleaf"), (740, 150, 20, "broadleaf"), (870, 260, 16, "palm"), (950, 230, 15, "palm"),
        # South Campus & Industrial
        (465, 620, 18, "broadleaf"), (465, 710, 16, "conifer"), (465, 840, 19, "broadleaf"), (465, 930, 17, "broadleaf"),
        (555, 620, 17, "broadleaf"), (555, 710, 16, "broadleaf"), (555, 840, 18, "palm"), (555, 930, 17, "conifer"),
        (255, 590, 16, "broadleaf"), (255, 710, 17, "broadleaf"), (255, 830, 18, "broadleaf"), (255, 930, 16, "conifer"),
        (765, 590, 16, "broadleaf"), (765, 710, 15, "broadleaf"), (765, 930, 17, "palm")
    ]

    for tx, ty, tr, ttype in trees_coords:
        # Shadow
        sh_tx, sh_ty = int(tx - tr * 0.9), int(ty - tr * 0.9)
        cv2.circle(img, (sh_tx, sh_ty), int(tr * 0.9), (18, 22, 26), -1)
        # Crown
        if ttype == "conifer":
            c_color = (25, 85, 35)
        elif ttype == "palm":
            c_color = (65, 145, 30)
        else:
            c_color = (35, 125, 45)
        cv2.circle(img, (tx, ty), tr, c_color, -1)
        cv2.circle(img, (tx - 2, ty - 2), int(tr * 0.7), (min(255, c_color[0] + 25), min(255, c_color[1] + 30), min(255, c_color[2] + 20)), -1)

    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    Image.fromarray(img).save(file_path, quality=95)
    return file_path


def ensure_sample_datasets(sample_dir: str) -> Dict[str, str]:
    """
    Ensures that default benchmark satellite images exist in sample_data directory.
    Returns mapping of sample_id to absolute file path.
    """
    os.makedirs(sample_dir, exist_ok=True)
    samples = {
        "terrascope_metro_complex": os.path.join(sample_dir, "terrascope_metro_complex.png"),
        "suburban_residential": os.path.join(sample_dir, "suburban_residential.png"),
        "urban_highrise": os.path.join(sample_dir, "urban_highrise.png")
    }

    if not os.path.exists(samples["terrascope_metro_complex"]):
        create_terrascope_metro_complex_sample(samples["terrascope_metro_complex"])

    if not os.path.exists(samples["suburban_residential"]):
        create_suburban_residential_sample(samples["suburban_residential"])

    if not os.path.exists(samples["urban_highrise"]):
        create_urban_highrise_sample(samples["urban_highrise"])

    return samples

