from __future__ import annotations

from pathlib import Path
from typing import Any

from ..tourstar_autolog_pipeline import (
    RuntimeOptions,
    ScoreWeights,
    evaluate_image,
    normalize_weights,
    resolve_default_artifacts_dir,
)
from ..inference.contracts import FullInferenceRequest


def resolve_artifacts_dir(artifacts_dir: str | None, service_root: Path) -> Path:
    if artifacts_dir:
        return Path(artifacts_dir)
    return resolve_default_artifacts_dir(service_root)


def build_weights_from_full_request(req: FullInferenceRequest) -> ScoreWeights:
    return normalize_weights(
        ScoreWeights(
            composition=req.w_composition,
            quality=req.w_quality,
            expression=req.w_expression,
        )
    )


def build_runtime_from_full_request(req: FullInferenceRequest) -> RuntimeOptions:
    return RuntimeOptions(
        device=req.device,
        yolo_imgsz=req.yolo_imgsz,
        max_musiq_side=req.max_musiq_side,
        max_blur_side=req.max_blur_side,
        cleanup_interval=req.cleanup_interval,
        min_quality=req.min_quality,
        min_blur=req.min_blur,
        min_composition=req.min_composition,
        min_subject_completeness=req.min_subject_completeness,
        style_priority=req.style_priority,
    )


def infer_full_row(
    req: FullInferenceRequest,
    yolo_model: Any,
    musiq_model: Any,
    pose_model: Any | None,
    device: str,
) -> dict[str, Any]:
    runtime = build_runtime_from_full_request(req)
    weights = build_weights_from_full_request(req)
    return evaluate_image(Path(req.image_path), yolo_model, pose_model, musiq_model, device, weights, runtime)


