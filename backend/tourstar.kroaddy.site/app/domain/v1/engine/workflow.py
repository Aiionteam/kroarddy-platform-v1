from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Callable
from uuid import uuid4

from ..contracts import EvaluationRequest, EvaluationResult, SelectedImage
from ..tourstar_autolog_pipeline import (
    RuntimeOptions,
    ScoreWeights,
    ensure_cache_env,
    evaluate_candidate,
    evaluate_image,
    list_images,
    load_models,
    normalize_weights,
    save_csv,
    save_selected_images,
    save_selection_summary,
    select_best_and_worst,
)

InferFunc = Callable[
    [Path, Path, RuntimeOptions, ScoreWeights, Any, Any, Any | None, str],
    dict[str, Any],
]


def run_photo_selection(
    req: EvaluationRequest,
    service_root: Path,
    infer_func: InferFunc | None = None,
    job_id: str | None = None,
    requested_at: datetime | None = None,
) -> EvaluationResult:
    job_id = job_id or uuid4().hex
    requested_at = requested_at or datetime.now()
    timestamp = requested_at.strftime("%Y%m%d_%H%M%S")

    artifacts_dir = Path(req.artifacts_dir) if req.artifacts_dir else service_root / "artifacts"
    input_dir = Path(req.input_dir) if req.input_dir else artifacts_dir / "samples"
    if not input_dir.exists():
        raise FileNotFoundError(f"입력 폴더가 없습니다: {input_dir}")

    ensure_cache_env(artifacts_dir)
    weights = normalize_weights(
        ScoreWeights(
            composition=req.w_composition,
            quality=req.w_quality,
            expression=req.w_expression,
        )
    )
    runtime = RuntimeOptions(
        device=req.device,
        min_quality=req.min_quality,
        min_blur=req.min_blur,
        min_composition=req.min_composition,
        min_subject_completeness=req.min_subject_completeness,
        style_priority=req.style_priority,
        start_index=req.start_index,
        max_images=req.max_images,
    )

    images_all = list_images(input_dir)
    images = images_all[runtime.start_index :]
    if runtime.max_images is not None:
        images = images[: runtime.max_images]
    if not images:
        raise ValueError(f"평가할 이미지가 없습니다: {input_dir}")

    yolo_model, musiq_model, pose_model, device, _, _ = load_models(artifacts_dir, runtime.device)
    infer = infer_func or _infer_local
    rows: list[dict[str, Any]] = []
    for image_path in images:
        row = infer(image_path, artifacts_dir, runtime, weights, yolo_model, musiq_model, pose_model, device)
        is_candidate, reason = evaluate_candidate(row, runtime)
        row["is_candidate"] = is_candidate
        row["reject_reason"] = reason
        rows.append(row)

    rows.sort(
        key=lambda x: (1 if bool(x.get("is_candidate", False)) else 0, float(x.get("final_score", 0.0))),
        reverse=True,
    )

    output_csv = artifacts_dir / "logs" / f"bestshot_scores_{timestamp}.csv"
    save_csv(rows, output_csv)

    best_rows, worst_rows = select_best_and_worst(rows, top_k=req.top_k)
    selection_root = artifacts_dir / "selections" / timestamp
    _, _, saved_records = save_selected_images(best_rows, worst_rows, selection_root)
    summary_csv = save_selection_summary(saved_records, selection_root)

    best = [_to_selected_image(r) for r in saved_records if r.get("selection_type") == "best"]
    worst = [_to_selected_image(r) for r in saved_records if r.get("selection_type") == "worst"]
    return EvaluationResult(
        job_id=job_id,
        requested_at=requested_at,
        output_csv=str(output_csv),
        selection_root=str(selection_root),
        summary_csv=str(summary_csv),
        best=best,
        worst=worst,
    )


def _infer_local(
    image_path: Path,
    _artifacts_dir: Path,
    runtime: RuntimeOptions,
    weights: ScoreWeights,
    yolo_model: Any,
    musiq_model: Any,
    pose_model: Any | None,
    device: str,
) -> dict[str, Any]:
    return evaluate_image(image_path, yolo_model, pose_model, musiq_model, device, weights, runtime)


def _to_selected_image(row: dict[str, Any]) -> SelectedImage:
    return SelectedImage(
        rank=int(row.get("rank", 0)),
        source_image=str(row.get("source_image", "")),
        saved_image=str(row.get("saved_image", "")),
        final_score=float(row.get("final_score", 0.0)),
        is_candidate=bool(row.get("is_candidate", False)),
        reject_reason=str(row.get("reject_reason", "")),
    )


