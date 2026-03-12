from __future__ import annotations

from pathlib import Path
from threading import Lock
from typing import Any

from ..engine.scoring import infer_full_row, resolve_artifacts_dir
from ..tourstar_autolog_pipeline import load_models
from .contracts import FullInferenceRequest


class InferenceService:
    """로컬 모델 추론을 캐시해 재사용하는 inference service."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._model_cache: dict[tuple[str, str], tuple[Any, Any, Any | None, str]] = {}

    def resolve_artifacts_dir(self, artifacts_dir: str | None) -> Path:
        return resolve_artifacts_dir(artifacts_dir, Path(__file__).resolve().parents[4])

    def infer_full(self, req: FullInferenceRequest) -> dict[str, Any]:
        artifacts_dir = self.resolve_artifacts_dir(req.artifacts_dir)
        cache_key = (str(artifacts_dir), req.device)
        with self._lock:
            cached = self._model_cache.get(cache_key)
            if cached is None:
                yolo_model, musiq_model, pose_model, device, _, _ = load_models(artifacts_dir, req.device)
                cached = (yolo_model, musiq_model, pose_model, device)
                self._model_cache[cache_key] = cached
        yolo_model, musiq_model, pose_model, device = cached

        return infer_full_row(req, yolo_model, musiq_model, pose_model, device)


