"""
Persistent Investigation Workspace & Long-Running Worker Service for Agent37.
=============================================================================
Provides durable, queryable investigation records, multi-step workflow tracking,
task dependency management, failure retry tracking, and scheduled monitoring.
Stores investigation records safely in local JSON persistence without secrets.
"""

import os
import json
import time
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone


INVESTIGATION_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "investigations"
)


class InvestigationService:
    def __init__(self, storage_dir: Optional[str] = None):
        self.storage_dir = storage_dir or INVESTIGATION_DIR
        os.makedirs(self.storage_dir, exist_ok=True)

    def _file_path(self, investigation_id: str) -> str:
        # Sanitize ID to prevent directory traversal
        safe_id = "".join(c for c in investigation_id if c.isalnum() or c in ("-", "_"))
        return os.path.join(self.storage_dir, f"{safe_id}.json")

    def create_investigation(
        self,
        area_name: str,
        objectives: Optional[List[str]] = None,
        job_id: Optional[str] = None,
        input_image_ids: Optional[List[str]] = None,
        acquisition_dates: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Creates a new durable investigation record."""
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()
        inv_id = f"inv_{now_dt.strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"

        default_objectives = objectives or [
            "3D Building Footprint & Elevation Extraction",
            "Topographic Slope & Terrain Relief Analysis",
            "Bitemporal Structural Change & Hazard Susceptibility"
        ]

        record = {
            "investigation_id": inv_id,
            "area_name": area_name,
            "job_id": job_id or f"job_{inv_id}",
            "created_at": now_iso,
            "last_successful_update": now_iso,
            "input_image_ids": input_image_ids or [f"tile_{area_name}_rgb"],
            "acquisition_dates": acquisition_dates or {
                "baseline_date": "2026-03-15T10:30:00Z",
                "latest_pass": now_iso
            },
            "objectives": default_objectives,
            "completed_operations": [],
            "pending_tasks": [
                {
                    "task_id": "task_1_area_assessment",
                    "operation": "get_analysis_results",
                    "description": "Extract building footprints, heights, and terrain density",
                    "dependencies": [],
                    "status": "PENDING"
                },
                {
                    "task_id": "task_2_terrain_summary",
                    "operation": "get_terrain_summary",
                    "description": "Profile ground elevations, slopes, and Copernicus 30m calibration",
                    "dependencies": ["task_1_area_assessment"],
                    "status": "PENDING"
                },
                {
                    "task_id": "task_3_bitemporal_comparison",
                    "operation": "get_change_detection_results",
                    "description": "Compare pre/post disaster imagery for structural collapse",
                    "dependencies": ["task_1_area_assessment"],
                    "status": "PENDING"
                },
                {
                    "task_id": "task_4_final_report",
                    "operation": "generate_analysis_report",
                    "description": "Synthesize certified evidence-based geospatial intelligence report",
                    "dependencies": ["task_1_area_assessment", "task_2_terrain_summary"],
                    "status": "PENDING"
                }
            ],
            "errors": [],
            "evidence_references": {
                "area_name": area_name,
                "buildings_analyzed": 0,
                "elevation_source": "Copernicus 30m DEM + ResNet50 U-Net Depth",
                "verified_outputs": []
            },
            "final_report_status": "IN_PROGRESS",
            "scheduled_monitoring": {
                "enabled": False,
                "frequency": "daily",
                "last_run": None,
                "next_scheduled_run": None,
                "consecutive_passes": 1
            }
        }

        self._save(record)
        return record

    def _save(self, record: Dict[str, Any]) -> None:
        path = self._file_path(record["investigation_id"])
        with open(path, "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2)

    def get_investigation(self, investigation_id: str) -> Optional[Dict[str, Any]]:
        path = self._file_path(investigation_id)
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    def update_investigation(self, investigation_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Updates specific fields of an investigation record and persists changes."""
        rec = self.get_investigation(investigation_id)
        if not rec:
            return None
        rec.update(updates)
        rec["last_successful_update"] = datetime.now(timezone.utc).isoformat()
        self._save(rec)
        return rec

    def list_investigations(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Lists existing investigation records sorted by recency."""
        records: List[Dict[str, Any]] = []
        if not os.path.exists(self.storage_dir):
            return records

        for fname in os.listdir(self.storage_dir):
            if fname.endswith(".json") and fname.startswith("inv_"):
                fpath = os.path.join(self.storage_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        records.append({
                            "investigation_id": data.get("investigation_id"),
                            "area_name": data.get("area_name"),
                            "created_at": data.get("created_at"),
                            "last_successful_update": data.get("last_successful_update"),
                            "final_report_status": data.get("final_report_status"),
                            "completed_count": len(data.get("completed_operations", [])),
                            "pending_count": len(data.get("pending_tasks", [])),
                            "objectives": data.get("objectives", [])
                        })
                except Exception:
                    continue

        records.sort(key=lambda r: r.get("last_successful_update", ""), reverse=True)
        return records[:limit]

    def get_or_create_latest(self, area_name: str, job_id: Optional[str] = None) -> Dict[str, Any]:
        """Retrieves the latest investigation for the given area, or creates a new one."""
        all_inv = self.list_investigations(limit=50)
        matching = [inv for inv in all_inv if inv.get("area_name") == area_name]
        if matching:
            full = self.get_investigation(matching[0]["investigation_id"])
            if full and full.get("final_report_status") in ("IN_PROGRESS", "COMPLETED"):
                return full

        return self.create_investigation(area_name=area_name, job_id=job_id)

    def record_operation(
        self,
        investigation_id: str,
        operation: str,
        result_summary: str,
        status: str = "SUCCESS",
        evidence: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        model_identifier: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Records a completed or failed operation with model provenance, updating task dependencies."""
        rec = self.get_investigation(investigation_id)
        if not rec:
            return None

        now_iso = datetime.now(timezone.utc).isoformat()
        rec["last_successful_update"] = now_iso
        resolved_model = model_identifier or "terrascope-grounded-deterministic:v2"

        if status == "SUCCESS":
            rec["completed_operations"].append({
                "operation": operation,
                "timestamp": now_iso,
                "summary": result_summary,
                "status": "SUCCESS",
                "model_identifier": resolved_model,
                "task_status": "VERIFIED_COMPLETED"
            })
            # Remove from pending if matches an operation
            rec["pending_tasks"] = [
                t for t in rec.get("pending_tasks", []) if t.get("operation") != operation
            ]
            if evidence:
                rec["evidence_references"].update(evidence)
                if operation not in rec["evidence_references"].get("verified_outputs", []):
                    rec["evidence_references"].setdefault("verified_outputs", []).append(operation)

            if len(rec["pending_tasks"]) == 0:
                rec["final_report_status"] = "COMPLETED"
        else:
            rec["errors"].append({
                "operation": operation,
                "timestamp": now_iso,
                "error": error or "Operation failed",
                "retry_allowed": True
            })

        self._save(rec)
        return rec

    def resume_investigation(self, investigation_id: str) -> Dict[str, Any]:
        """
        Inspects completed vs pending operations and returns actionable tasks
        to resume without re-running expensive cached results.
        """
        rec = self.get_investigation(investigation_id)
        if not rec:
            return {"status": "NOT_FOUND", "message": f"Investigation {investigation_id} not found."}

        completed_ops = {op["operation"] for op in rec.get("completed_operations", [])}
        pending = rec.get("pending_tasks", [])

        ready_tasks = []
        blocked_tasks = []

        for task in pending:
            deps = task.get("dependencies", [])
            if all(dep in completed_ops for dep in deps):
                ready_tasks.append(task)
            else:
                blocked_tasks.append(task)

        return {
            "status": "RESUMED",
            "investigation_id": investigation_id,
            "area_name": rec.get("area_name"),
            "completed_count": len(completed_ops),
            "completed_operations": list(completed_ops),
            "ready_to_execute": ready_tasks,
            "blocked_by_dependencies": blocked_tasks,
            "final_report_status": rec.get("final_report_status")
        }

    def set_scheduled_monitoring(
        self,
        investigation_id: str,
        enabled: bool = True,
        frequency: str = "daily"
    ) -> Optional[Dict[str, Any]]:
        """Configures persistent scheduled monitoring for this geographical investigation."""
        rec = self.get_investigation(investigation_id)
        if not rec:
            return None

        rec["scheduled_monitoring"]["enabled"] = enabled
        rec["scheduled_monitoring"]["frequency"] = frequency
        rec["last_successful_update"] = datetime.now(timezone.utc).isoformat()
        self._save(rec)
        return rec

    def delete_investigation(self, investigation_id: str) -> bool:
        path = self._file_path(investigation_id)
        if os.path.exists(path):
            try:
                os.remove(path)
                return True
            except Exception:
                return False
        return False


# Global singleton instance
investigation_service = InvestigationService()
