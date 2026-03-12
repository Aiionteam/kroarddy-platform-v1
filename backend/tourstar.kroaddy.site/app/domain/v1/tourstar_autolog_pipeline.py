"""Tourstar Auto-Log MVP pipeline.

YOLO11n(구도/인물 검출) + MUSIQ(전반 화질/미학) 기반으로
이미지 배치에서 베스트샷을 자동 선정한다.
"""

from __future__ import annotations

import argparse
import csv
import gc
import math
import os
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pyiqa
import torch
from ultralytics import YOLO


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


@dataclass
class ScoreWeights:
    """최종 점수 가중치."""

    composition: float = 0.30
    quality: float = 0.50
    expression: float = 0.20


@dataclass
class RuntimeOptions:
    """실행 안정성/부하 제어 옵션."""

    device: str = "auto"
    yolo_imgsz: int = 640
    max_musiq_side: int = 1200
    max_blur_side: int = 1600
    cleanup_interval: int = 1
    min_quality: float = 0.45
    min_blur: float = 0.08
    min_composition: float = 0.45
    min_subject_completeness: float = 0.70
    style_priority: float = 0.90
    start_index: int = 0
    max_images: int | None = None


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def normalize_weights(weights: ScoreWeights) -> ScoreWeights:
    total = weights.composition + weights.quality + weights.expression
    if total <= 0:
        raise ValueError("가중치 합은 0보다 커야 합니다.")
    return ScoreWeights(
        composition=weights.composition / total,
        quality=weights.quality / total,
        expression=weights.expression / total,
    )


def normalize_musiq(raw_score: float) -> float:
    """MUSIQ raw score를 0~1로 정규화.

    pyiqa musiq는 보통 0~100 범위에 가깝기 때문에 단순 스케일링한다.
    """
    return clamp01(raw_score / 100.0)


def sharpness_score(image_bgr: np.ndarray) -> float:
    """라플라시안 분산 기반 선명도 점수(보조 지표)."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    var_lap = cv2.Laplacian(gray, cv2.CV_64F).var()
    # 경험적 범위 정규화: 50(흐림) ~ 500(선명)
    return clamp01((float(var_lap) - 50.0) / 450.0)


def center_distance_score(cx: float, cy: float, width: int, height: int) -> float:
    """주 피사체 중심이 프레임 중앙에 가까울수록 점수 상승."""
    d = math.dist((cx, cy), (width / 2.0, height / 2.0))
    d_max = math.dist((0, 0), (width / 2.0, height / 2.0))
    return 1.0 - clamp01(d / (d_max + 1e-6))


def range_preference_score(value: float, low: float, high: float, floor: float = 0.0, ceil: float = 1.0) -> float:
    """값이 [low, high]에 있으면 1점, 바깥은 선형 감점."""
    v = float(value)
    if low <= v <= high:
        return 1.0
    if v < low:
        denom = max(1e-6, low - floor)
        return clamp01((v - floor) / denom)
    denom = max(1e-6, ceil - high)
    return clamp01((ceil - v) / denom)


def travel_tone_score(image_bgr: np.ndarray) -> float:
    """여행 사진에서 선호되는 밝고 깔끔한 톤/색감을 근사 점수화."""
    frame = downscale_if_needed(image_bgr, max_side=1280)
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    sat_ch = hsv[:, :, 1].astype(np.float32) / 255.0
    val_ch = hsv[:, :, 2].astype(np.float32) / 255.0
    sat = float(np.mean(sat_ch))
    sat_std = float(np.std(sat_ch))
    val = float(np.mean(val_ch))
    val_std = float(np.std(val_ch))
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    contrast = float(np.std(gray)) / 128.0
    highlights = float(np.mean(gray >= 240))
    shadows = float(np.mean(gray <= 25))

    sat_score = range_preference_score(sat, low=0.18, high=0.62, floor=0.05, ceil=0.90)
    val_score = range_preference_score(val, low=0.42, high=0.82, floor=0.18, ceil=0.98)
    contrast_score = range_preference_score(contrast, low=0.22, high=0.62, floor=0.05, ceil=0.95)
    sat_var_score = range_preference_score(sat_std, low=0.08, high=0.22, floor=0.02, ceil=0.40)
    val_var_score = range_preference_score(val_std, low=0.10, high=0.30, floor=0.03, ceil=0.50)
    highlight_penalty = range_preference_score(highlights, low=0.00, high=0.06, floor=0.00, ceil=0.25)
    shadow_penalty = range_preference_score(shadows, low=0.00, high=0.08, floor=0.00, ceil=0.30)
    return clamp01(
        0.22 * sat_score
        + 0.25 * val_score
        + 0.20 * contrast_score
        + 0.15 * sat_var_score
        + 0.08 * val_var_score
        + 0.05 * highlight_penalty
        + 0.05 * shadow_penalty
    )


def thirds_distance_score(cx: float, cy: float, width: int, height: int) -> float:
    """주 피사체 중심이 rule-of-thirds 교차점에 얼마나 가까운지 점수화."""
    points = [
        (width / 3.0, height / 3.0),
        (2.0 * width / 3.0, height / 3.0),
        (width / 3.0, 2.0 * height / 3.0),
        (2.0 * width / 3.0, 2.0 * height / 3.0),
    ]
    d_min = min(math.dist((cx, cy), p) for p in points)
    d_max = math.dist((0, 0), (width, height))
    return 1.0 - clamp01(d_min / (d_max + 1e-6))


def size_balance_score(box_area_ratio: float) -> float:
    """주 피사체 크기 점수.

    너무 작거나(배경 과다), 너무 크면(크롭/답답함) 감점한다.
    """
    target_low, target_high = 0.08, 0.35
    if target_low <= box_area_ratio <= target_high:
        return 1.0
    if box_area_ratio < target_low:
        return clamp01(box_area_ratio / target_low)
    # target_high 초과 시 완만히 감소
    overflow = min(1.0, (box_area_ratio - target_high) / 0.45)
    return clamp01(1.0 - overflow)


def composition_from_person_boxes(
    person_boxes: list[list[float]],
    width: int,
    height: int,
) -> float:
    """YOLO person 박스 기반 구도 점수."""
    if not person_boxes:
        return 0.2

    img_area = float(width * height)
    # 가장 큰 person을 주 피사체로 가정
    main = max(person_boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
    x1, y1, x2, y2 = main
    bw = max(0.0, x2 - x1)
    bh = max(0.0, y2 - y1)
    area_ratio = (bw * bh) / (img_area + 1e-6)
    cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0

    thirds = thirds_distance_score(cx, cy, width, height)
    size_bal = size_balance_score(area_ratio)
    people_count_bonus = clamp01(min(len(person_boxes), 4) / 4.0)

    center = center_distance_score(cx, cy, width, height)
    context_fit = range_preference_score(area_ratio, low=0.04, high=0.28, floor=0.01, ceil=0.60)

    # 여행 사진 특성을 반영해 thirds + center + 인물/배경 균형을 함께 본다.
    score = 0.30 * thirds + 0.25 * center + 0.25 * size_bal + 0.15 * context_fit + 0.05 * people_count_bonus
    return clamp01(score)


def main_person_box(person_boxes: list[list[float]]) -> list[float] | None:
    """가장 큰 인물 박스를 주 피사체로 반환."""
    if not person_boxes:
        return None
    return max(person_boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))


def subject_completeness_score(main_box: list[float] | None, width: int, height: int) -> float:
    """주 피사체가 프레임에 온전히 담겼는지 연속형 점수화."""
    if main_box is None:
        return 0.0
    x1, y1, x2, y2 = main_box
    bw = max(1.0, x2 - x1)
    bh = max(1.0, y2 - y1)
    img_area = float(width * height)

    left_margin = x1 / max(1.0, float(width))
    right_margin = (float(width) - x2) / max(1.0, float(width))
    top_margin = y1 / max(1.0, float(height))
    bottom_margin = (float(height) - y2) / max(1.0, float(height))

    left_score = clamp01(left_margin / 0.02)
    right_score = clamp01(right_margin / 0.02)
    top_score = clamp01(top_margin / 0.04)
    bottom_score = clamp01(bottom_margin / 0.08)
    edge_score = 0.18 * left_score + 0.18 * right_score + 0.24 * top_score + 0.40 * bottom_score

    aspect_ratio = bh / (bw + 1e-6)
    aspect_score = range_preference_score(aspect_ratio, low=1.45, high=4.0, floor=0.8, ceil=5.5)
    area_ratio = (bw * bh) / (img_area + 1e-6)
    size_score = range_preference_score(area_ratio, low=0.05, high=0.35, floor=0.02, ceil=0.70)
    return clamp01(0.65 * edge_score + 0.20 * aspect_score + 0.15 * size_score)


def pose_completeness_score(pose_result: Any, width: int, height: int) -> float | None:
    """Pose keypoint 기반 완전성 점수(가능할 때만 사용)."""
    if pose_result is None or getattr(pose_result, "keypoints", None) is None:
        return None
    keypoints = getattr(pose_result.keypoints, "data", None)
    if keypoints is None:
        return None
    if hasattr(keypoints, "cpu"):
        keypoints_np = keypoints.cpu().numpy()
    else:
        keypoints_np = np.asarray(keypoints)
    if keypoints_np.size == 0:
        return None

    conf_mat = keypoints_np[:, :, 2]
    person_idx = int(np.argmax(np.mean(conf_mat, axis=1)))
    kps = keypoints_np[person_idx]
    conf = kps[:, 2]
    visible = conf > 0.35
    visible_ratio = float(np.mean(visible))

    lower_ids = [11, 12, 13, 14, 15, 16]  # hip/knee/ankle
    lower_visible = float(np.mean(conf[lower_ids] > 0.35))

    if np.any(visible):
        xs = np.clip(kps[:, 0] / max(1.0, float(width)), 0.0, 1.0)
        ys = np.clip(kps[:, 1] / max(1.0, float(height)), 0.0, 1.0)
        margins = np.minimum.reduce([xs, 1.0 - xs, ys, 1.0 - ys])
        border_score = clamp01(float(np.mean(np.clip(margins[visible] / 0.06, 0.0, 1.0))))
    else:
        border_score = 0.0

    return clamp01(0.45 * visible_ratio + 0.35 * lower_visible + 0.20 * border_score)


def extract_person_boxes(result: Any) -> list[list[float]]:
    """YOLO 결과에서 person class(0) 박스 추출."""
    boxes_out: list[list[float]] = []
    if result.boxes is None or result.boxes.cls is None:
        return boxes_out

    classes = result.boxes.cls.tolist()
    coords = result.boxes.xyxy.tolist()
    for cls_id, xyxy in zip(classes, coords):
        if int(cls_id) == 0:
            boxes_out.append([float(v) for v in xyxy])
    return boxes_out


def estimate_expression_score(person_count: int, composition: float, tone: float) -> float:
    """표정 모델 전 임시 점수.

    추후 YOLO cls/전용 face-expression 모델로 교체할 영역.
    """
    if person_count == 0:
        return 0.2
    interaction_bonus = range_preference_score(float(person_count), low=1.0, high=3.0, floor=0.0, ceil=6.0)
    # 전용 표정 모델이 없으므로 구도/톤/다인물 상호작용으로 자연스러움을 근사한다.
    return clamp01(0.25 + 0.45 * composition + 0.20 * tone + 0.10 * interaction_bonus)


def ensure_cache_env(artifacts_dir: Path) -> None:
    """현재 프로세스에서 모델 캐시 경로를 artifacts 하위로 강제."""
    models_dir = artifacts_dir / "models"
    os.environ.setdefault("TORCH_HOME", str(models_dir / "torch_cache"))
    os.environ.setdefault("HF_HOME", str(models_dir / "hf_cache"))
    os.environ.setdefault("XDG_CACHE_HOME", str(models_dir / "xdg_cache"))


def resolve_device(device_preference: str) -> str:
    pref = device_preference.lower()
    if pref not in {"auto", "cpu", "cuda"}:
        raise ValueError(f"지원하지 않는 device 옵션: {device_preference}")
    if pref == "cpu":
        return "cpu"
    if pref == "cuda":
        if not torch.cuda.is_available():
            raise RuntimeError("device=cuda로 지정했지만 CUDA를 사용할 수 없습니다.")
        return "cuda"
    return "cuda" if torch.cuda.is_available() else "cpu"


def load_models(artifacts_dir: Path, device_preference: str) -> tuple[YOLO, Any, Any | None, str, Path, Path | None]:
    device = resolve_device(device_preference)
    yolo_weight_path = artifacts_dir / "models" / "yolo" / "yolo11n.pt"
    if not yolo_weight_path.exists():
        raise FileNotFoundError(
            f"YOLO 가중치가 없습니다: {yolo_weight_path}. "
            "먼저 yolo11n.pt를 해당 경로에 배치하세요."
        )

    yolo_model = YOLO(str(yolo_weight_path))
    pose_weight_candidate = artifacts_dir / "models" / "yolo" / "yolo11n-pose.pt"
    pose_weight_path: Path | None = None
    pose_model: Any | None = None
    if pose_weight_candidate.exists():
        pose_weight_path = pose_weight_candidate
        pose_model = YOLO(str(pose_weight_path))
    musiq_model = pyiqa.create_metric("musiq", device=device)
    return yolo_model, musiq_model, pose_model, device, yolo_weight_path, pose_weight_path


def downscale_if_needed(image_bgr: np.ndarray, max_side: int) -> np.ndarray:
    """선명도 보조지표 계산용 다운스케일."""
    if max_side <= 0:
        return image_bgr
    h, w = image_bgr.shape[:2]
    current_max = max(h, w)
    if current_max <= max_side:
        return image_bgr
    scale = max_side / float(current_max)
    resized = cv2.resize(
        image_bgr,
        (int(w * scale), int(h * scale)),
        interpolation=cv2.INTER_AREA,
    )
    return resized


def build_musiq_tensor(image_bgr: np.ndarray, max_side: int, device: str) -> torch.Tensor:
    """MUSIQ 입력용 텐서 생성(해상도 상한 적용)."""
    frame = downscale_if_needed(image_bgr, max_side)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    tensor = torch.from_numpy(rgb).permute(2, 0, 1).float().div(255.0).unsqueeze(0)
    return tensor.to(device)


def is_cuda_oom_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "out of memory" in msg or "cuda error: out of memory" in msg


_MUSIQ_CPU_FALLBACK: Any | None = None


def score_musiq_with_fallback(
    image_bgr: np.ndarray,
    musiq_model: Any,
    device: str,
    max_musiq_side: int,
) -> tuple[float, str]:
    """MUSIQ 점수 계산. CUDA OOM 시 CPU fallback."""
    global _MUSIQ_CPU_FALLBACK
    with torch.inference_mode():
        try:
            musiq_input = build_musiq_tensor(image_bgr, max_musiq_side, device)
            score = float(musiq_model(musiq_input).item())
            del musiq_input
            return score, device
        except RuntimeError as exc:
            if device != "cuda" or not is_cuda_oom_error(exc):
                raise
            torch.cuda.empty_cache()
            if _MUSIQ_CPU_FALLBACK is None:
                _MUSIQ_CPU_FALLBACK = pyiqa.create_metric("musiq", device="cpu")
            musiq_input_cpu = build_musiq_tensor(image_bgr, max_musiq_side, "cpu")
            score = float(_MUSIQ_CPU_FALLBACK(musiq_input_cpu).item())
            del musiq_input_cpu
            return score, "cpu-fallback"


def evaluate_image(
    image_path: Path,
    yolo_model: YOLO,
    pose_model: Any | None,
    musiq_model: Any,
    device: str,
    weights: ScoreWeights,
    runtime: RuntimeOptions,
) -> dict[str, Any]:
    image_bgr = cv2.imread(str(image_path))
    if image_bgr is None:
        raise ValueError(f"이미지를 읽을 수 없습니다: {image_path}")

    h, w = image_bgr.shape[:2]
    yolo_result = yolo_model(
        str(image_path),
        device=0 if device == "cuda" else "cpu",
        imgsz=runtime.yolo_imgsz,
        verbose=False,
    )[0]
    person_boxes = extract_person_boxes(yolo_result)
    person_count = len(person_boxes)
    main_box = main_person_box(person_boxes)

    composition = composition_from_person_boxes(person_boxes, w, h)
    subject_completeness_bbox = subject_completeness_score(main_box, w, h)
    subject_completeness = subject_completeness_bbox
    if pose_model is not None:
        pose_result = pose_model(
            str(image_path),
            device=0 if device == "cuda" else "cpu",
            imgsz=runtime.yolo_imgsz,
            verbose=False,
        )[0]
        pose_score = pose_completeness_score(pose_result, w, h)
        if pose_score is not None:
            subject_completeness = clamp01(0.55 * subject_completeness_bbox + 0.45 * pose_score)
    musiq_raw, musiq_device = score_musiq_with_fallback(
        image_bgr=image_bgr,
        musiq_model=musiq_model,
        device=device,
        max_musiq_side=runtime.max_musiq_side,
    )
    musiq_norm = normalize_musiq(musiq_raw)
    blur_frame = downscale_if_needed(image_bgr, runtime.max_blur_side)
    blur_aux = sharpness_score(blur_frame)
    tone_score = travel_tone_score(image_bgr)
    quality = clamp01(0.65 * musiq_norm + 0.20 * blur_aux + 0.15 * tone_score)
    expression = estimate_expression_score(person_count, composition, tone_score)

    base_score = (
        weights.composition * composition
        + weights.quality * quality
        + weights.expression * expression
    )
    story_score = clamp01(
        0.30 * composition + 0.25 * expression + 0.20 * tone_score + 0.25 * subject_completeness
    )
    technical_score = clamp01(0.70 * quality + 0.30 * blur_aux)
    style_priority = clamp01(runtime.style_priority)
    final_score = (1.0 - style_priority) * base_score + style_priority * story_score

    # 기술 품질은 하드컷이 아니라 최소 안전장치로만 반영한다.
    if person_count == 0:
        final_score *= 0.88
    if blur_aux < 0.06:
        final_score *= 0.92
    if quality < 0.35:
        final_score *= 0.90
    if subject_completeness < 0.50:
        final_score *= 0.86

    return {
        "image": str(image_path),
        "person_count": person_count,
        "composition_score": round(composition, 4),
        "subject_completeness_score": round(subject_completeness, 4),
        "musiq_raw": round(musiq_raw, 4),
        "musiq_device": musiq_device,
        "musiq_norm": round(musiq_norm, 4),
        "blur_aux_score": round(blur_aux, 4),
        "tone_score": round(tone_score, 4),
        "quality_score": round(quality, 4),
        "expression_score": round(expression, 4),
        "story_score": round(story_score, 4),
        "technical_score": round(technical_score, 4),
        "final_score": round(clamp01(final_score), 4),
        "is_candidate": True,
        "reject_reason": "",
        "error": "",
    }


def evaluate_candidate(row: dict[str, Any], runtime: RuntimeOptions) -> tuple[bool, str]:
    reasons: list[str] = []
    if float(row.get("quality_score", 0.0)) < runtime.min_quality:
        reasons.append("low_quality")
    if float(row.get("blur_aux_score", 0.0)) < runtime.min_blur:
        reasons.append("too_blurry")
    if float(row.get("composition_score", 0.0)) < runtime.min_composition:
        reasons.append("weak_composition")
    if float(row.get("subject_completeness_score", 0.0)) < runtime.min_subject_completeness:
        reasons.append("cropped_subject")
    if int(row.get("person_count", 0)) <= 0:
        reasons.append("no_person")

    if reasons:
        return False, ",".join(reasons)
    return True, ""


def list_images(input_dir: Path) -> list[Path]:
    return sorted(
        [p for p in input_dir.iterdir() if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS]
    )


def save_csv(rows: list[dict[str, Any]], output_csv: Path) -> None:
    if not rows:
        return
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def select_best_and_worst(rows: list[dict[str, Any]], top_k: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """상위/하위 이미지를 점수 기준으로 선택."""
    valid_rows = [r for r in rows if not str(r.get("error", "")).strip()]
    if not valid_rows:
        return [], []

    candidates = [r for r in valid_rows if bool(r.get("is_candidate", False))]
    best_rows = sorted(candidates, key=lambda r: float(r.get("final_score", 0.0)), reverse=True)[:top_k]
    if len(best_rows) < top_k:
        # 후보가 부족하면 no_person/cropped_subject를 제외한 차선 후보로 채운다.
        selected = {str(r.get("image", "")) for r in best_rows}
        supplements = [
            row
            for row in sorted(valid_rows, key=lambda rr: float(rr.get("final_score", 0.0)), reverse=True)
            if str(row.get("image", "")) not in selected
            and "no_person" not in str(row.get("reject_reason", ""))
            and "cropped_subject" not in str(row.get("reject_reason", ""))
        ]
        best_rows.extend(supplements[: max(0, top_k - len(best_rows))])
    if not best_rows:
        best_rows = sorted(valid_rows, key=lambda r: float(r.get("final_score", 0.0)), reverse=True)[:top_k]
    worst_rows = sorted(valid_rows, key=lambda r: float(r.get("final_score", 0.0)))[:top_k]
    return best_rows, worst_rows


def save_selected_images(
    best_rows: list[dict[str, Any]],
    worst_rows: list[dict[str, Any]],
    output_dir: Path,
) -> tuple[Path, Path, list[dict[str, Any]]]:
    """선정된 이미지를 best/worst 폴더로 복사 저장."""
    best_dir = output_dir / "best"
    worst_dir = output_dir / "worst"
    best_dir.mkdir(parents=True, exist_ok=True)
    worst_dir.mkdir(parents=True, exist_ok=True)
    saved_records: list[dict[str, Any]] = []

    def _copy_rows(rows: list[dict[str, Any]], target_dir: Path, selection_type: str) -> None:
        for idx, row in enumerate(rows, start=1):
            src = Path(str(row.get("image", "")))
            if not src.exists():
                continue
            score = float(row.get("final_score", 0.0))
            dst_name = f"{idx:02d}_{score:.4f}_{src.name}"
            dst_path = target_dir / dst_name
            shutil.copy2(src, dst_path)
            saved_records.append(
                {
                    "selection_type": selection_type,
                    "rank": idx,
                    "source_image": str(src),
                    "saved_image": str(dst_path),
                    "final_score": row.get("final_score", 0.0),
                    "is_candidate": row.get("is_candidate", False),
                    "reject_reason": row.get("reject_reason", ""),
                    "person_count": row.get("person_count", -1),
                    "composition_score": row.get("composition_score", 0.0),
                    "subject_completeness_score": row.get("subject_completeness_score", 0.0),
                    "tone_score": row.get("tone_score", 0.0),
                    "quality_score": row.get("quality_score", 0.0),
                    "expression_score": row.get("expression_score", 0.0),
                    "story_score": row.get("story_score", 0.0),
                    "technical_score": row.get("technical_score", 0.0),
                    "musiq_device": row.get("musiq_device", ""),
                    "error": row.get("error", ""),
                }
            )

    _copy_rows(best_rows, best_dir, "best")
    _copy_rows(worst_rows, worst_dir, "worst")
    return best_dir, worst_dir, saved_records


def save_selection_summary(saved_records: list[dict[str, Any]], output_dir: Path) -> Path:
    """best/worst 선정 결과 요약 CSV 저장."""
    summary_csv = output_dir / "selection_summary.csv"
    if not saved_records:
        with summary_csv.open("w", newline="", encoding="utf-8") as f:
            simple_writer = csv.writer(f)
            simple_writer.writerow(
                [
                    "selection_type",
                    "rank",
                    "source_image",
                    "saved_image",
                    "final_score",
                    "is_candidate",
                    "reject_reason",
                    "person_count",
                    "composition_score",
                    "subject_completeness_score",
                    "tone_score",
                    "quality_score",
                    "expression_score",
                    "story_score",
                    "technical_score",
                    "musiq_device",
                    "error",
                ]
            )
        return summary_csv

    with summary_csv.open("w", newline="", encoding="utf-8") as f:
        dict_writer = csv.DictWriter(f, fieldnames=list(saved_records[0].keys()))
        dict_writer.writeheader()
        dict_writer.writerows(saved_records)
    return summary_csv


def resolve_default_artifacts_dir(base_dir: Path) -> Path:
    """tourstar 우선, 없으면 기존 langgraph 경로를 fallback."""
    env_override = os.getenv("TOURSTAR_ARTIFACTS_DIR", "").strip()
    if env_override:
        return Path(env_override)

    # 현재 경로 및 상위 경로에서 artifacts를 탐색 (v1 하위 실행 포함)
    for candidate_base in [base_dir, *base_dir.parents]:
        artifacts = candidate_base / "artifacts"
        if artifacts.exists():
            return artifacts

    legacy_artifacts = base_dir.parent / "langgraph" / "app" / "core" / "artifacts"
    if legacy_artifacts.exists():
        return legacy_artifacts
    return base_dir / "artifacts"


def parse_args() -> argparse.Namespace:
    base_core = Path(__file__).resolve().parent
    default_artifacts = resolve_default_artifacts_dir(base_core)
    default_input = default_artifacts / "samples"

    parser = argparse.ArgumentParser(description="Tourstar Auto-Log MVP pipeline")
    parser.add_argument("--input-dir", type=Path, default=default_input, help="평가할 이미지 폴더")
    parser.add_argument("--artifacts-dir", type=Path, default=default_artifacts, help="artifacts 루트 폴더")
    parser.add_argument("--output-csv", type=Path, default=None, help="결과 CSV 파일 경로(미지정 시 자동)")
    parser.add_argument(
        "--top-k",
        type=int,
        default=3,
        help="잘 나온/못 나온 사진으로 저장할 개수",
    )
    parser.add_argument(
        "--selection-dir",
        type=Path,
        default=None,
        help="Top 선정 이미지 저장 루트 폴더(미지정 시 artifacts/selections/<timestamp>)",
    )
    parser.add_argument(
        "--w-composition",
        type=float,
        default=0.30,
        help="최종 점수 내 composition 가중치",
    )
    parser.add_argument(
        "--w-quality",
        type=float,
        default=0.50,
        help="최종 점수 내 quality 가중치",
    )
    parser.add_argument(
        "--w-expression",
        type=float,
        default=0.20,
        help="최종 점수 내 expression 가중치",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="auto",
        choices=["auto", "cpu", "cuda"],
        help="추론 장치 선택(auto/cpu/cuda)",
    )
    parser.add_argument(
        "--yolo-imgsz",
        type=int,
        default=640,
        help="YOLO 추론 입력 해상도(작을수록 빠르고 가벼움)",
    )
    parser.add_argument(
        "--max-musiq-side",
        type=int,
        default=1200,
        help="MUSIQ 입력 최대 변 길이(작을수록 VRAM 절약)",
    )
    parser.add_argument(
        "--max-blur-side",
        type=int,
        default=1600,
        help="blur 보조지표 계산 시 최대 변 길이(작을수록 메모리 절약)",
    )
    parser.add_argument(
        "--cleanup-interval",
        type=int,
        default=1,
        help="N장마다 gc/cuda 캐시 정리(0이면 비활성화)",
    )
    parser.add_argument(
        "--min-quality",
        type=float,
        default=0.45,
        help="후보 유지 최소 quality_score (미만이면 제외)",
    )
    parser.add_argument(
        "--min-blur",
        type=float,
        default=0.08,
        help="후보 유지 최소 blur_aux_score (미만이면 제외)",
    )
    parser.add_argument(
        "--min-composition",
        type=float,
        default=0.45,
        help="후보 유지 최소 composition_score (미만이면 제외)",
    )
    parser.add_argument(
        "--min-subject-completeness",
        type=float,
        default=0.70,
        help="후보 유지 최소 subject_completeness_score (미만이면 인물 잘림으로 제외)",
    )
    parser.add_argument(
        "--style-priority",
        type=float,
        default=0.90,
        help="최종 점수에서 주제/구도/톤 중심 스코어 비율(0~1, 높을수록 스타일 우선)",
    )
    parser.add_argument(
        "--start-index",
        type=int,
        default=0,
        help="정렬된 이미지 목록에서 시작 인덱스",
    )
    parser.add_argument(
        "--max-images",
        type=int,
        default=None,
        help="최대 처리 이미지 수(미지정 시 전체)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    artifacts_dir: Path = args.artifacts_dir
    input_dir: Path = args.input_dir

    ensure_cache_env(artifacts_dir)
    weights = normalize_weights(
        ScoreWeights(
            composition=args.w_composition,
            quality=args.w_quality,
            expression=args.w_expression,
        )
    )
    runtime = RuntimeOptions(
        device=args.device,
        yolo_imgsz=args.yolo_imgsz,
        max_musiq_side=args.max_musiq_side,
        max_blur_side=args.max_blur_side,
        cleanup_interval=args.cleanup_interval,
        min_quality=args.min_quality,
        min_blur=args.min_blur,
        min_composition=args.min_composition,
        min_subject_completeness=args.min_subject_completeness,
        style_priority=args.style_priority,
        start_index=args.start_index,
        max_images=args.max_images,
    )

    if not input_dir.exists():
        raise FileNotFoundError(f"입력 폴더가 없습니다: {input_dir}")

    images_all = list_images(input_dir)
    start = max(0, runtime.start_index)
    images = images_all[start:]
    if runtime.max_images is not None and runtime.max_images > 0:
        images = images[: runtime.max_images]

    if not images:
        print(f"[INFO] 입력 이미지가 없습니다: {input_dir}")
        print("[INFO] jpg/png 이미지를 넣고 다시 실행하세요.")
        return

    yolo_model, musiq_model, pose_model, device, yolo_weight_path, pose_weight_path = load_models(
        artifacts_dir, runtime.device
    )
    print(f"[INFO] device={device}")
    print(f"[INFO] yolo_weight={yolo_weight_path}")
    if pose_weight_path is not None:
        print(f"[INFO] pose_weight={pose_weight_path}")
    else:
        print("[INFO] pose_weight=none (bbox completeness only)")
    print(
        f"[INFO] selected_images={len(images)} "
        f"(total={len(images_all)} start_index={start} max_images={runtime.max_images})"
    )
    print(
        f"[INFO] yolo_imgsz={runtime.yolo_imgsz} "
        f"max_musiq_side={runtime.max_musiq_side} "
        f"max_blur_side={runtime.max_blur_side} cleanup_interval={runtime.cleanup_interval}"
    )
    print(
        f"[INFO] weights(comp/qual/expr)="
        f"{weights.composition:.2f}/{weights.quality:.2f}/{weights.expression:.2f}"
    )
    print(
        f"[INFO] candidate_filter min_quality={runtime.min_quality:.2f} "
        f"min_blur={runtime.min_blur:.2f} "
        f"min_composition={runtime.min_composition:.2f} "
        f"min_subject_completeness={runtime.min_subject_completeness:.2f}"
    )
    print(f"[INFO] style_priority={clamp01(runtime.style_priority):.2f}")
    print(f"[INFO] evaluating {len(images)} images...")

    rows: list[dict[str, Any]] = []
    for idx, image_path in enumerate(images, start=1):
        try:
            row = evaluate_image(image_path, yolo_model, pose_model, musiq_model, device, weights, runtime)
            is_candidate, reason = evaluate_candidate(row, runtime)
            row["is_candidate"] = is_candidate
            row["reject_reason"] = reason
            rows.append(row)
        except Exception as exc:  # noqa: BLE001
            rows.append(
                {
                    "image": str(image_path),
                    "person_count": -1,
                    "composition_score": 0.0,
                    "subject_completeness_score": 0.0,
                    "musiq_raw": 0.0,
                    "musiq_device": "n/a",
                    "musiq_norm": 0.0,
                    "blur_aux_score": 0.0,
                    "tone_score": 0.0,
                    "quality_score": 0.0,
                    "expression_score": 0.0,
                    "story_score": 0.0,
                    "technical_score": 0.0,
                    "final_score": 0.0,
                    "is_candidate": False,
                    "reject_reason": "inference_error",
                    "error": str(exc),
                }
            )
        finally:
            if runtime.cleanup_interval > 0 and idx % runtime.cleanup_interval == 0:
                gc.collect()
                if device == "cuda":
                    torch.cuda.empty_cache()

    rows.sort(
        key=lambda x: (
            1 if bool(x.get("is_candidate", False)) else 0,
            float(x.get("final_score", 0.0)),
        ),
        reverse=True,
    )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    if args.output_csv is None:
        output_csv = artifacts_dir / "logs" / f"bestshot_scores_{timestamp}.csv"
    else:
        output_csv = args.output_csv

    save_csv(rows, output_csv)

    top_k = max(1, int(args.top_k))
    best_rows, worst_rows = select_best_and_worst(rows, top_k=top_k)
    if args.selection_dir is None:
        selection_root = artifacts_dir / "selections" / timestamp
    else:
        selection_root = args.selection_dir
    best_dir, worst_dir, saved_records = save_selected_images(best_rows, worst_rows, selection_root)
    summary_csv = save_selection_summary(saved_records, selection_root)

    candidates = [r for r in rows if bool(r.get("is_candidate", False))]
    best = candidates[0] if candidates else rows[0]
    print(f"[DONE] saved: {output_csv}")
    print(f"[DONE] saved_top_best: {best_dir}")
    print(f"[DONE] saved_top_worst: {worst_dir}")
    print(f"[DONE] saved_selection_summary: {summary_csv}")
    print(f"[INFO] candidates={len(candidates)} / total={len(rows)}")
    if not candidates:
        print("[WARN] 후보 조건을 만족한 이미지가 없어 전체 점수 1등을 대신 출력합니다.")
    print(f"[BEST] image={best.get('image')} final_score={best.get('final_score')}")


if __name__ == "__main__":
    main()

