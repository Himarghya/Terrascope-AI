"""
GeoDepth 3D / Terrascope AI — Disaster Intelligence & Structural Change Assessment Engine

Flagship Innovation Module:
Performs pre-event vs. post-event building structural change detection,
xBD-compliant damage severity classification, height collapse analysis (ΔH),
and volumetric debris estimation with explicit uncertainty bounds.
"""

import os
import io
import base64
import math
import uuid
import time
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import cv2
from PIL import Image

from .image_loader import load_image_rgb, inspect_image_file


# Standard FEMA / USACE Debris Expansion Factor for structural masonry & reinforced concrete
DEFAULT_BULKING_FACTOR = 1.30  # Loose rubble occupies ~30% more volume than consolidated structure
BULKING_UNCERTAINTY = 0.15     # ±15% variance due to void ratio and structural material variance


class DisasterAssessmentEngine:
    """
    Core engine for pre/post-disaster bi-temporal change detection,
    spatial alignment verification, xBD damage classification, and rubble volume quantification.
    """

    MODEL_VERSION = "GeoTwin-BiTemporalChange-xBD-v2.1"

    def __init__(self, pipeline=None):
        self.pipeline = pipeline

    @staticmethod
    def _encode_crop_b64(rgb_crop: np.ndarray, max_side: int = 96) -> str:
        """Encodes an RGB building crop as a compact data-URI PNG for side-by-side evidence inspection."""
        try:
            if rgb_crop.size == 0:
                return ""
            ch, cw = rgb_crop.shape[:2]
            if max(ch, cw) > max_side:
                sc = max_side / float(max(ch, cw))
                rgb_crop = cv2.resize(rgb_crop, (max(8, int(cw * sc)), max(8, int(ch * sc))), interpolation=cv2.INTER_AREA)
            pil_img = Image.fromarray(rgb_crop.astype(np.uint8))
            buf = io.BytesIO()
            pil_img.save(buf, format="PNG", optimize=True)
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            return f"data:image/png;base64,{b64}"
        except Exception:
            return ""

    @staticmethod
    def verify_spatial_alignment(pre_rgb: np.ndarray, post_rgb_aligned: np.ndarray, orig_post_shape: Tuple[int, int]) -> Dict[str, Any]:
        """
        Verifies geographic/pixel co-registration and radiometric consistency between
        pre-event and post-event images using Fourier Phase Correlation and edge coherence.
        """
        h, w = pre_rgb.shape[:2]
        g1 = cv2.cvtColor(pre_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
        g2 = cv2.cvtColor(post_rgb_aligned, cv2.COLOR_RGB2GRAY).astype(np.float32)

        try:
            win = cv2.createHanningWindow((w, h), cv2.CV_32F)
            (dx, dy), response = cv2.phaseCorrelate(g1, g2, win)
        except Exception:
            dx, dy, response = 0.0, 0.0, 0.75

        shift_px = float(math.hypot(dx, dy))
        illum_diff = float(np.mean(g2) - np.mean(g1))
        std1 = float(np.std(g1))
        std2 = float(np.std(g2))
        contrast_ratio = round(std2 / max(std1, 1.0), 2)
        resolution_match = (orig_post_shape[0] == h and orig_post_shape[1] == w)

        # Edge structural correlation
        e1 = cv2.Sobel(g1, cv2.CV_32F, 1, 1, ksize=3)
        e2 = cv2.Sobel(g2, cv2.CV_32F, 1, 1, ksize=3)
        denom = float(np.linalg.norm(e1) * np.linalg.norm(e2))
        edge_corr = float(np.sum(e1 * e2) / denom) if denom > 1e-5 else 0.5
        align_conf = round(float(np.clip(0.55 + 0.35 * max(0.0, edge_corr) + 0.10 * min(1.0, response), 0.35, 0.99)), 2)

        warnings = []
        if not resolution_match:
            warnings.append(f"Post-event image resampled from {orig_post_shape[1]}x{orig_post_shape[0]} to {w}x{h} px.")
        if shift_px > 6.0:
            warnings.append(f"Detected translational offset of ({dx:.1f}, {dy:.1f}) px; co-registration uncertainty elevated.")
        if abs(illum_diff) > 35.0:
            warnings.append(f"Significant lighting/seasonal brightness shift ({illum_diff:+.1f} DN); normalized prior to change inference.")

        return {
            "is_aligned": shift_px <= 12.0,
            "is_spatially_aligned": shift_px <= 12.0,
            "estimated_shift_px": {"dx": round(float(dx), 2), "dy": round(float(dy), 2), "magnitude_px": round(shift_px, 2)},
            "phase_correlation_response": round(float(response), 3),
            "edge_structural_coherence": round(float(edge_corr), 3),
            "alignment_confidence": align_conf,
            "resolution_match": resolution_match,
            "illumination_shift_dn": round(illum_diff, 1),
            "contrast_ratio": contrast_ratio,
            "quality_warnings": warnings
        }

    def assess_scenes(
        self,
        pre_rgb: np.ndarray,
        post_rgb: np.ndarray,
        pre_buildings: List[Dict[str, Any]],
        post_buildings: Optional[List[Dict[str, Any]]] = None,
        pre_hgt: Optional[np.ndarray] = None,
        post_hgt: Optional[np.ndarray] = None,
        gsd_m: float = 0.35,
        bulking_factor: float = DEFAULT_BULKING_FACTOR
    ) -> Dict[str, Any]:
        """
        Executes structural change assessment between pre-event and post-event data.
        
        Args:
            pre_rgb: (H, W, 3) Pre-event RGB image.
            post_rgb: (H, W, 3) Post-event RGB image.
            pre_buildings: Extracted building inventory from pre-event scene.
            post_buildings: Extracted building inventory from post-event scene (optional).
            pre_hgt: (H, W) Metric height raster (meters AGL) for pre-event.
            post_hgt: (H, W) Metric height raster (meters AGL) for post-event.
            gsd_m: Ground sampling distance in meters/pixel.
            bulking_factor: Volumetric expansion coefficient for rubble.
            
        Returns:
            Dictionary containing detailed building assessments, KPI summary, and GeoJSON.
        """
        h_pre, w_pre = pre_rgb.shape[:2]
        h_post, w_post = post_rgb.shape[:2]
        height_evidence_available = (pre_hgt is not None) and (post_hgt is not None)

        # Ensure post_rgb is matched to pre dimensions if slight difference exists
        if (h_post, w_post) != (h_pre, w_pre):
            post_rgb_aligned = cv2.resize(post_rgb, (w_pre, h_pre), interpolation=cv2.INTER_LINEAR)
            if post_hgt is not None:
                post_hgt_aligned = cv2.resize(post_hgt, (w_pre, h_pre), interpolation=cv2.INTER_LINEAR)
            else:
                post_hgt_aligned = None
        else:
            post_rgb_aligned = post_rgb
            post_hgt_aligned = post_hgt

        alignment_info = self.verify_spatial_alignment(pre_rgb, post_rgb_aligned, (h_post, w_post))

        # Fallback if height rasters are not provided: infer or estimate
        if pre_hgt is None:
            pre_hgt = np.zeros((h_pre, w_pre), dtype=np.float32)
            for b in pre_buildings:
                poly = np.array(b["polygon_px"], dtype=np.int32)
                cv2.fillPoly(pre_hgt, [poly], float(b.get("estimated_height_m", 6.0)))

        if post_hgt_aligned is None:
            # If no post height raster provided, calculate structural texture variance
            gray_pre = cv2.cvtColor(pre_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
            gray_post = cv2.cvtColor(post_rgb_aligned, cv2.COLOR_RGB2GRAY).astype(np.float32)
            diff = np.abs(gray_post - gray_pre)
            # Estimate post height reduction proportional to texture disruption
            post_hgt_aligned = np.maximum(0.0, pre_hgt * (1.0 - np.clip(diff / 120.0, 0.0, 0.9)))

        # Pre and Post Landcover Classification for Environmental Change Detection
        lc_pre_map = None
        lc_post_map = None
        try:
            from .landcover import classify_landcover
            lc_pre_map = classify_landcover(pre_rgb)[0]
            lc_post_map = classify_landcover(post_rgb_aligned)[0]
        except Exception:
            pass

        assessed_buildings = []
        counts = {
            "no_damage": 0,
            "minor_damage": 0,
            "major_damage": 0,
            "destroyed": 0,
            "new_or_extended": 0,
            "uncertain": 0
        }
        total_debris_volume_m3 = 0.0
        total_debris_uncertainty_m3 = 0.0

        for idx_b, b in enumerate(pre_buildings):
            b_id = b.get("id", f"BLD-{len(assessed_buildings)+1:03d}")
            poly = np.array(b["polygon_px"], dtype=np.int32)
            area_m2 = float(b.get("footprint_area_m2", 0.0))
            if area_m2 <= 0.0:
                area_px = cv2.contourArea(poly)
                area_m2 = area_px * (gsd_m ** 2)

            # Create bounding mask for this building
            x, y, bw, bh = cv2.boundingRect(poly)
            x_end = min(w_pre, x + bw)
            y_end = min(h_pre, y + bh)
            x = max(0, x)
            y = max(0, y)

            if bw <= 0 or bh <= 0 or x_end <= x or y_end <= y:
                continue

            crop_mask = np.zeros((y_end - y, x_end - x), dtype=np.uint8)
            poly_shifted = poly - np.array([x, y])
            cv2.fillPoly(crop_mask, [poly_shifted], 1)

            # Sample pre and post heights within the footprint
            pre_crop = pre_hgt[y:y_end, x:x_end]
            post_crop = post_hgt_aligned[y:y_end, x:x_end]

            mask_pixels = crop_mask > 0
            if not np.any(mask_pixels):
                continue

            pre_height_vals = pre_crop[mask_pixels]
            post_height_vals = post_crop[mask_pixels]

            h_pre_m = float(np.median(pre_height_vals)) if pre_height_vals.size else float(b.get("estimated_height_m", 6.0))
            h_post_m = float(np.median(post_height_vals)) if post_height_vals.size else h_pre_m

            # Calculate height delta and collapse ratio
            delta_h_m = max(0.0, h_pre_m - h_post_m)
            height_gain_m = max(0.0, h_post_m - h_pre_m)
            collapse_ratio = (delta_h_m / max(h_pre_m, 1.0))

            # Compute local spectral perturbation adjusted for global illumination shifts
            global_shift = np.mean(post_rgb_aligned) - np.mean(pre_rgb)
            pre_rgb_crop = pre_rgb[y:y_end, x:x_end][mask_pixels]
            post_rgb_crop = post_rgb_aligned[y:y_end, x:x_end][mask_pixels]
            if pre_rgb_crop.size and post_rgb_crop.size:
                mean_pre_rgb = np.mean(pre_rgb_crop, axis=0)
                mean_post_rgb = np.mean(post_rgb_crop, axis=0)
                # Adjusted color difference removing uniform scene illumination changes
                color_dist = float(np.linalg.norm((mean_post_rgb - global_shift) - mean_pre_rgb)) / 255.0
            else:
                color_dist = 0.0

            # Edge / roughness change (rubble increases high-frequency spatial gradients)
            laplacian_post = cv2.Laplacian(cv2.cvtColor(post_rgb_aligned[y:y_end, x:x_end], cv2.COLOR_RGB2GRAY), cv2.CV_32F)
            roughness = float(np.var(laplacian_post[mask_pixels])) if mask_pixels.any() else 0.0

            # Check post landcover within building footprint for mudflow or water inundation
            mud_flood_ratio = 0.0
            if lc_post_map is not None:
                post_lc_crop = lc_post_map[y:y_end, x:x_end][mask_pixels]
                if post_lc_crop.size > 0:
                    mud_flood_ratio = float(np.mean((post_lc_crop == 1) | (post_lc_crop == 6)))

            # If building is heavily inundated by mud or floodwaters, check if residual height indicates burial
            is_inundated = (mud_flood_ratio >= 0.35) and (delta_h_m >= 1.5 or h_post_m <= 2.5)
            if is_inundated and post_hgt is None:
                h_post_m = min(h_post_m, 0.5)
                delta_h_m = max(0.0, h_pre_m - h_post_m)
                collapse_ratio = (delta_h_m / max(h_pre_m, 1.0))

            is_partial_inundation = (mud_flood_ratio >= 0.15) and (delta_h_m >= 1.0 or h_post_m <= 4.0)

            # xBD Joint Damage Classification + GeoTwin Change Classes:
            # 0: No Significant Detected Change
            # 1: Roof or Visible Structural Alteration (Minor Damage)
            # 2: Possible Disaster Damage (Major Damage)
            # 3: Removed Structure / Possible Collapse (Destroyed)
            quality_flags = []
            if not alignment_info["is_spatially_aligned"]:
                quality_flags.append("Caution: Pre/post spatial alignment uncertainty exceeds threshold")

            if height_gain_m >= 2.2 and height_evidence_available:
                damage_class = 0
                damage_label = "New or Extended Structure"
                predicted_change_class = "New or Extended Structure"
                severity = "Low"
                confidence = 0.84
                counts["new_or_extended"] += 1
                counts["no_damage"] += 1
            elif collapse_ratio >= 0.55 or (collapse_ratio >= 0.40 and roughness > 450.0) or is_inundated:
                damage_class = 3
                damage_label = "Destroyed"
                predicted_change_class = "Removed Structure" if collapse_ratio >= 0.70 else "Possible Disaster Damage"
                severity = "Critical"
                confidence = 0.95 if is_inundated else (0.91 if height_evidence_available else 0.76)
                counts["destroyed"] += 1
                if is_inundated:
                    quality_flags.append(f"Inundated by Landslide/Mudflow ({mud_flood_ratio*100:.0f}% mud coverage)")
            elif collapse_ratio >= 0.25 or (collapse_ratio >= 0.18 and (color_dist > 0.20 or roughness > 350.0)) or is_partial_inundation:
                damage_class = 2
                damage_label = "Major Damage"
                predicted_change_class = "Possible Disaster Damage"
                severity = "High"
                confidence = 0.86 if height_evidence_available else 0.74
                counts["major_damage"] += 1
                if is_partial_inundation:
                    quality_flags.append(f"Partial Mud Deposition ({mud_flood_ratio*100:.0f}%)")
            elif collapse_ratio >= 0.10 or (color_dist > 0.18 and roughness > 250.0):
                damage_class = 1
                damage_label = "Minor Damage"
                predicted_change_class = "Roof or Visible Structural Alteration"
                severity = "Moderate"
                confidence = 0.82 if height_evidence_available else 0.71
                counts["minor_damage"] += 1
            elif color_dist > 0.22 and roughness <= 250.0:
                damage_class = 0
                damage_label = "No Damage"
                predicted_change_class = "Uncertain or Insufficient Evidence"
                severity = "Low"
                confidence = 0.58
                counts["no_damage"] += 1
                counts["uncertain"] += 1
                quality_flags.append("Appearance shift without geometric/texture disruption — structural damage not confirmed")
            else:
                damage_class = 0
                damage_label = "No Damage"
                predicted_change_class = "No Significant Detected Change"
                severity = "Low"
                confidence = 0.94
                counts["no_damage"] += 1

            # Debris volume calculation:
            # V_debris = Footprint Area * Delta H * Bulking Factor
            debris_vol_m3 = round(area_m2 * delta_h_m * bulking_factor, 1)
            # Uncertainty estimation combining measurement error and bulking uncertainty
            vol_unc_m3 = round(debris_vol_m3 * math.sqrt((0.10)**2 + (0.12)**2 + (BULKING_UNCERTAINTY / bulking_factor)**2), 1)

            total_debris_volume_m3 += debris_vol_m3
            total_debris_uncertainty_m3 += vol_unc_m3 ** 2

            if delta_h_m > 0 and h_post_m < 2.0 and height_evidence_available:
                quality_flags.append("Significant Height Reduction Detected")
            if color_dist > 0.30:
                quality_flags.append("High Spectral Alteration (Scorching, Repainting, or Debris Inundation)")

            if damage_class == 3:
                if mud_flood_ratio >= 0.35:
                    change_summary = f"Removed structure / severe inundation (-{delta_h_m:.1f}m, {collapse_ratio*100:.0f}% height reduction). {mud_flood_ratio*100:.0f}% of footprint covered in sediment/debris."
                else:
                    change_summary = f"Severe structural alteration / possible collapse (-{delta_h_m:.1f}m, {collapse_ratio*100:.0f}% reduction). Estimated {debris_vol_m3:,.0f} m³ displaced volume."
            elif damage_class == 2:
                if mud_flood_ratio >= 0.15:
                    change_summary = f"Possible disaster damage with mud deposition (-{delta_h_m:.1f}m, {collapse_ratio*100:.0f}% reduction)."
                else:
                    change_summary = f"Possible disaster damage (-{delta_h_m:.1f}m, {collapse_ratio*100:.0f}% reduction). Partial roof alteration and high surface roughness."
            elif damage_class == 1:
                change_summary = f"Roof or visible structural alteration (-{delta_h_m:.1f}m, {collapse_ratio*100:.0f}% change). Primary footprint intact."
            elif predicted_change_class == "Uncertain or Insufficient Evidence":
                change_summary = "Visual color shift detected without supporting geometric or texture disruption; insufficient evidence to confirm structural damage."
            elif predicted_change_class == "New or Extended Structure":
                change_summary = f"Vertical or footprint extension detected (+{height_gain_m:.1f}m)."
            else:
                change_summary = "No significant detected change. Preserved roof geometry and appearance."

            pre_crop_b64 = None
            post_crop_b64 = None
            if idx_b < 60:
                pad = 8
                cy0, cy1 = max(0, y - pad), min(h_pre, y_end + pad)
                cx0, cx1 = max(0, x - pad), min(w_pre, x_end + pad)
                pre_crop_b64 = self._encode_crop_b64(pre_rgb[cy0:cy1, cx0:cx1])
                post_crop_b64 = self._encode_crop_b64(post_rgb_aligned[cy0:cy1, cx0:cx1])

            assessed_buildings.append({
                "building_id": b_id,
                "damage_class": damage_class,
                "damage_label": damage_label,
                "predicted_change_class": predicted_change_class,
                "severity": severity,
                "change_summary": change_summary,
                "pre_height_m": round(h_pre_m, 2),
                "post_height_m": round(h_post_m, 2),
                "delta_height_m": round(delta_h_m, 2) if height_evidence_available else None,
                "estimated_delta_height_m": round(delta_h_m, 2),
                "height_evidence_available": height_evidence_available,
                "collapse_percentage": round(collapse_ratio * 100.0, 1),
                "footprint_area_m2": round(area_m2, 1),
                "estimated_footprint_diff_m2": round(-area_m2 * collapse_ratio if damage_class >= 2 else 0.0, 1),
                "debris_volume_m3": debris_vol_m3,
                "debris_uncertainty_m3": vol_unc_m3,
                "confidence_score": confidence,
                "roughness_metric": round(roughness, 1),
                "polygon_px": b["polygon_px"],
                "center_px": b.get("center_px", [int(x + bw / 2), int(y + bh / 2)]),
                "building_type": b.get("building_type", "Residential / Commercial"),
                "quality_flags": quality_flags,
                "pre_crop_b64": pre_crop_b64,
                "post_crop_b64": post_crop_b64,
                "verification_status": "unverified_remote_sensing_estimate",
                "model_version": self.MODEL_VERSION
            })

        # Also check post_buildings for newly constructed structures not present in pre_buildings
        if post_buildings:
            pre_mask_all = np.zeros((h_pre, w_pre), dtype=np.uint8)
            for b in pre_buildings:
                cv2.fillPoly(pre_mask_all, [np.array(b["polygon_px"], dtype=np.int32)], 1)
            for pb in post_buildings:
                poly = np.array(pb["polygon_px"], dtype=np.int32)
                x, y, bw, bh = cv2.boundingRect(poly)
                x_end, y_end = min(w_pre, x + bw), min(h_pre, y + bh)
                x, y = max(0, x), max(0, y)
                if x_end <= x or y_end <= y:
                    continue
                overlap = float(np.mean(pre_mask_all[y:y_end, x:x_end] > 0))
                if overlap < 0.15:
                    area_m2 = float(pb.get("footprint_area_m2", cv2.contourArea(poly) * (gsd_m ** 2)))
                    h_post_m = float(pb.get("estimated_height_m", 6.0))
                    counts["new_or_extended"] += 1
                    assessed_buildings.append({
                        "building_id": f"BLD-NEW-{counts['new_or_extended']:03d}",
                        "damage_class": 0,
                        "damage_label": "New or Extended Structure",
                        "predicted_change_class": "New or Extended Structure",
                        "severity": "Low",
                        "change_summary": f"New structure detected in post-event scene ({area_m2:.1f} m² footprint).",
                        "pre_height_m": 0.0,
                        "post_height_m": round(h_post_m, 2),
                        "delta_height_m": round(-h_post_m, 2) if height_evidence_available else None,
                        "estimated_delta_height_m": 0.0,
                        "height_evidence_available": height_evidence_available,
                        "collapse_percentage": 0.0,
                        "footprint_area_m2": round(area_m2, 1),
                        "estimated_footprint_diff_m2": round(area_m2, 1),
                        "debris_volume_m3": 0.0,
                        "debris_uncertainty_m3": 0.0,
                        "confidence_score": 0.85,
                        "roughness_metric": 0.0,
                        "polygon_px": pb["polygon_px"],
                        "center_px": pb.get("center_px", [int(x + bw / 2), int(y + bh / 2)]),
                        "building_type": pb.get("building_type", "New Construction"),
                        "quality_flags": ["Newly detected post-event footprint"],
                        "pre_crop_b64": self._encode_crop_b64(pre_rgb[y:y_end, x:x_end]),
                        "post_crop_b64": self._encode_crop_b64(post_rgb_aligned[y:y_end, x:x_end]),
                        "verification_status": "unverified_remote_sensing_estimate",
                        "model_version": self.MODEL_VERSION
                    })

        total_debris_sigma = round(math.sqrt(total_debris_uncertainty_m3), 1)
        total_buildings = len(assessed_buildings)
        total_damaged = counts["minor_damage"] + counts["major_damage"] + counts["destroyed"]
        damage_rate_pct = round((total_damaged / max(total_buildings, 1)) * 100.0, 1)

        # Generate GeoJSON feature collection
        geojson_features = []
        for ab in assessed_buildings:
            # Generate local metric coordinates (centered at origin)
            poly_coords = []
            for pt in ab["polygon_px"]:
                xw = round((pt[0] - w_pre / 2.0) * gsd_m, 2)
                zw = round((pt[1] - h_pre / 2.0) * gsd_m, 2)
                poly_coords.append([xw, zw])
            if poly_coords and poly_coords[0] != poly_coords[-1]:
                poly_coords.append(poly_coords[0])

            geojson_features.append({
                "type": "Feature",
                "properties": {
                    "building_id": ab["building_id"],
                    "damage_class": ab["damage_class"],
                    "damage_label": ab["damage_label"],
                    "severity": ab["severity"],
                    "pre_height_m": ab["pre_height_m"],
                    "post_height_m": ab["post_height_m"],
                    "delta_height_m": ab["delta_height_m"],
                    "collapse_pct": ab["collapse_percentage"],
                    "footprint_area_m2": ab["footprint_area_m2"],
                    "debris_volume_m3": ab["debris_volume_m3"],
                    "debris_uncertainty_m3": ab["debris_uncertainty_m3"],
                    "confidence": ab["confidence_score"],
                    "quality_flags": ab["quality_flags"]
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [poly_coords]
                }
            })

        geojson = {
            "type": "FeatureCollection",
            "metadata": {
                "title": "Terrascope AI — Disaster Structural Damage & Debris Assessment",
                "generated_at": time.time(),
                "gsd_m": gsd_m,
                "bulking_factor": bulking_factor,
                "coordinate_system": "Local Metric Cartesian (Origin at Scene Center)"
            },
            "features": geojson_features
        }

        # Environmental and Landscape Impact Analysis
        total_px = h_pre * w_pre
        px_area_m2 = gsd_m * gsd_m
        total_scene_area_m2 = round(total_px * px_area_m2, 1)

        env_impact = {
            "total_scene_area_m2": total_scene_area_m2,
            "mudflow_debris_area_m2": 0.0,
            "mudflow_increase_pct": 0.0,
            "vegetation_loss_m2": 0.0,
            "vegetation_loss_pct": 0.0,
            "water_channel_shift_m2": 0.0,
            "environmental_summary": "Environmental terrain and landcover variance within baseline tolerance."
        }

        if lc_pre_map is not None and lc_post_map is not None:
            pre_mud_px = np.count_nonzero(lc_pre_map == 1)
            post_mud_px = np.count_nonzero(lc_post_map == 1)
            delta_mud_px = max(0, post_mud_px - pre_mud_px)
            delta_mud_m2 = round(delta_mud_px * px_area_m2, 1)
            mud_increase_pct = round((delta_mud_px / max(total_px, 1)) * 100.0, 1)

            pre_veg_px = np.count_nonzero((lc_pre_map == 2) | (lc_pre_map == 3))
            post_veg_px = np.count_nonzero((lc_post_map == 2) | (lc_post_map == 3))
            veg_loss_px = max(0, pre_veg_px - post_veg_px)
            veg_loss_m2 = round(veg_loss_px * px_area_m2, 1)
            veg_loss_pct = round((veg_loss_px / max(pre_veg_px, 1)) * 100.0, 1)

            pre_water_px = np.count_nonzero(lc_pre_map == 6)
            post_water_px = np.count_nonzero(lc_post_map == 6)
            water_diff_m2 = round(abs(post_water_px - pre_water_px) * px_area_m2, 1)

            summary_parts = []
            if delta_mud_m2 > 500.0:
                summary_parts.append(f"Catastrophic mudflow/landslide deposition: {delta_mud_m2:,.0f} m² of terrain buried under silt & rock deposits (+{mud_increase_pct:.1f}% total scene coverage).")
            if veg_loss_m2 > 500.0:
                summary_parts.append(f"Severe vegetation canopy loss: {veg_loss_m2:,.0f} m² of forest wiped out (-{veg_loss_pct:.1f}% canopy reduction).")
            if water_diff_m2 > 200.0:
                summary_parts.append(f"Hydrological river corridor displacement: {water_diff_m2:,.0f} m² of river bed altered and choked with sediment.")

            env_summary = " ".join(summary_parts) if summary_parts else "Terrain surface stable with minor localized landcover variations."

            env_impact = {
                "total_scene_area_m2": total_scene_area_m2,
                "mudflow_debris_area_m2": delta_mud_m2,
                "mudflow_increase_pct": mud_increase_pct,
                "vegetation_loss_m2": veg_loss_m2,
                "vegetation_loss_pct": veg_loss_pct,
                "water_channel_shift_m2": water_diff_m2,
                "environmental_summary": env_summary
            }

        # Build comprehensive incident intelligence report
        assessment_report = {
            "assessment_id": str(uuid.uuid4()),
            "timestamp": time.time(),
            "model_version": self.MODEL_VERSION,
            "verification_status": "unverified_remote_sensing_estimate",
            "gsd_m": gsd_m,
            "spatial_alignment": alignment_info,
            "scene_dimensions_px": {"width": w_pre, "height": h_pre},
            "scene_coverage_m": {"width": round(w_pre * gsd_m, 1), "height": round(h_pre * gsd_m, 1)},
            "summary_kpis": {
                "total_buildings_assessed": total_buildings,
                "total_damaged_structures": total_damaged,
                "overall_damage_rate_pct": damage_rate_pct,
                "destroyed_count": counts["destroyed"],
                "major_damage_count": counts["major_damage"],
                "minor_damage_count": counts["minor_damage"],
                "no_damage_count": counts["no_damage"],
                "new_or_extended_count": counts["new_or_extended"],
                "uncertain_count": counts["uncertain"],
                "total_debris_volume_m3": round(total_debris_volume_m3, 1),
                "debris_volume_uncertainty_m3": total_debris_sigma,
                "rubble_bulking_factor": bulking_factor,
                "emergency_priority": "CRITICAL" if counts["destroyed"] >= 3 or damage_rate_pct > 35 else ("HIGH" if total_damaged > 5 else "STANDARD"),
                "environmental_impact": env_impact
            },
            "environmental_impact": env_impact,
            "assessed_buildings": assessed_buildings,
            "geojson": geojson,
            "scientific_methodology": {
                "damage_standard": "xBD / Joint Damage Scale (Levels 0-3) + GeoTwin Bi-Temporal Change Taxonomy",
                "height_collapse_model": "ΔH = max(0, H_pre - H_post)",
                "volumetric_formulation": "V_debris = Area * ΔH * K_bulking ± σ_V",
                "assumptions_and_limitations": [
                    "Visual change detection is distinguished from confirmed structural collapse; appearance shifts alone are flagged as Uncertain.",
                    "Height differences are reported as measured only when pre and post elevation/3D evidence are available.",
                    "Debris expansion coefficient assumes mixed masonry/concrete rubble (K=1.30 ± 0.15).",
                    "Monocular RGB imagery cannot penetrate dense dust clouds or measure hidden subterranean foundation voids.",
                    "Ground truth validation requires post-event LiDAR, stereoscopic photogrammetric DSM, or field structural inspection."
                ]
            }
        }

        return assessment_report


# Backwards-compatible alias
DisasterDamageEngine = DisasterAssessmentEngine
