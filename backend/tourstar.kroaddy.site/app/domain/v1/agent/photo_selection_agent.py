from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any
import os

import httpx
from ..contracts import EvaluationRequest, EvaluationResult
from ..graph import build_photo_selection_graph
from ..tourstar_autolog_pipeline import (
    RuntimeOptions,
    ScoreWeights,
    evaluate_image,
)


class PhotoSelectionAgent:
    """LangGraph 기반으로 사진 선택 파이프라인을 실행하는 Agent."""

    def __init__(self, service_root: Path | None = None) -> None:
        self.service_root = service_root or Path(__file__).resolve().parents[4]
        self.inference_url = os.getenv("TOURSTAR_INFERENCE_URL", "").strip().rstrip("/")

    def evaluate(
        self,
        req: EvaluationRequest,
        job_id: str | None = None,
        requested_at: datetime | None = None,
    ) -> EvaluationResult:
        graph = build_photo_selection_graph()
        state = graph.invoke(
            {
                "request": req,
                "job_id": job_id or "",
                "requested_at": requested_at or datetime.now(),
                "service_root": self.service_root,
                "infer_func": self._infer_one,
            }
        )
        error = state.get("error")
        if error:
            raise RuntimeError(str(error))
        result = state.get("result")
        if result is None:
            raise RuntimeError("LangGraph evaluation did not produce a result.")
        return result

    def _infer_one(
        self,
        image_path: Path,
        artifacts_dir: Path,
        runtime: RuntimeOptions,
        weights: ScoreWeights,
        yolo_model: Any,
        musiq_model: Any,
        pose_model: Any | None,
        device: str,
    ) -> dict[str, Any]:
        if not self.inference_url:
            return evaluate_image(image_path, yolo_model, pose_model, musiq_model, device, weights, runtime)

        payload = {
            "image_path": str(image_path),
            "artifacts_dir": str(artifacts_dir),
            "device": runtime.device,
            "w_composition": weights.composition,
            "w_quality": weights.quality,
            "w_expression": weights.expression,
            "min_quality": runtime.min_quality,
            "min_blur": runtime.min_blur,
            "min_composition": runtime.min_composition,
            "min_subject_completeness": runtime.min_subject_completeness,
            "style_priority": runtime.style_priority,
            "yolo_imgsz": runtime.yolo_imgsz,
            "max_musiq_side": runtime.max_musiq_side,
            "max_blur_side": runtime.max_blur_side,
            "cleanup_interval": 0,
        }
        try:
            with httpx.Client(timeout=60.0) as client:
                res = client.post(f"{self.inference_url}/v1/inference/full", json=payload)
                res.raise_for_status()
                data = res.json()
                row = data.get("row")
                if isinstance(row, dict):
                    return row
        except Exception:
            # 원격 추론 실패 시 로컬 추론으로 자동 fallback
            pass

        return evaluate_image(image_path, yolo_model, pose_model, musiq_model, device, weights, runtime)


