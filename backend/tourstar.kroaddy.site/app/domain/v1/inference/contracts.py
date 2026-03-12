from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class InferenceRequest(BaseModel):
    image_path: str
    artifacts_dir: str | None = None
    device: Literal["auto", "cpu", "cuda"] = "auto"


class DetectResponse(BaseModel):
    image_path: str
    person_count: int
    composition_score: float


class QualityResponse(BaseModel):
    image_path: str
    blur_aux_score: float
    tone_score: float
    quality_score: float
    musiq_raw: float
    musiq_norm: float
    musiq_device: str


class CompletenessResponse(BaseModel):
    image_path: str
    subject_completeness_score: float


class FullInferenceRequest(InferenceRequest):
    w_composition: float = 0.30
    w_quality: float = 0.50
    w_expression: float = 0.20
    min_quality: float = 0.45
    min_blur: float = 0.08
    min_composition: float = 0.45
    min_subject_completeness: float = 0.70
    style_priority: float = 0.90
    yolo_imgsz: int = 640
    max_musiq_side: int = 1200
    max_blur_side: int = 1600
    cleanup_interval: int = Field(default=0, ge=0)


class FullInferenceResponse(BaseModel):
    row: dict


