from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, TypedDict

from ..contracts import EvaluationRequest, EvaluationResult


class PhotoSelectionGraphState(TypedDict, total=False):
    request: EvaluationRequest
    job_id: str
    requested_at: datetime
    service_root: Path
    infer_func: Any
    input_dir: str
    artifacts_dir: str
    image_paths: list[str]
    gps_records: list[dict[str, Any]]
    location_candidates: list[dict[str, Any]]
    location_hint: str
    metadata_only: bool
    result: EvaluationResult
    error: str

