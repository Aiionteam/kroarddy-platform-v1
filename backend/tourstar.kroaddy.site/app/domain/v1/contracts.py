from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class EvaluationRequest(BaseModel):
    input_dir: str | None = Field(default=None, description="평가할 이미지 디렉터리")
    artifacts_dir: str | None = Field(default=None, description="artifacts 루트 디렉터리")
    top_k: int = Field(default=3, ge=1, le=20)
    device: Literal["auto", "cpu", "cuda"] = "auto"
    start_index: int = Field(default=0, ge=0)
    max_images: int | None = Field(default=None, ge=1)
    w_composition: float = 0.30
    w_quality: float = 0.50
    w_expression: float = 0.20
    min_quality: float = 0.45
    min_blur: float = 0.08
    min_composition: float = 0.45
    min_subject_completeness: float = 0.70
    style_priority: float = 0.90
    timeout_seconds: int = Field(default=600, ge=30, le=3600)
    max_retries: int = Field(default=1, ge=0, le=5)


class SelectedImage(BaseModel):
    rank: int
    source_image: str
    saved_image: str
    final_score: float
    is_candidate: bool
    reject_reason: str


class EvaluationResult(BaseModel):
    job_id: str
    requested_at: datetime
    output_csv: str
    selection_root: str
    summary_csv: str
    best: list[SelectedImage]
    worst: list[SelectedImage]


class JobStatusResponse(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "failed"]
    requested_at: datetime
    attempts: int = 0
    max_retries: int = 0
    completed_at: datetime | None = None
    result: EvaluationResult | None = None
    error: str | None = None


class UploadedPhoto(BaseModel):
    name: str
    url: str
    size: int


class UploadPipelineJob(BaseModel):
    job_id: str
    status: Literal["queued"]


class UploadPhotosResponse(BaseModel):
    uploaded: list[UploadedPhoto]
    batch_dir: str
    pipeline_job: UploadPipelineJob | None = None


class GeneratePostRequest(BaseModel):
    comment: str = Field(default="", description="사용자가 입력한 한줄 코멘트")
    style_filter: str = Field(default="AUTO", description="MBTI 스타일 필터 (AUTO 또는 MBTI 코드)")
    style_template: str | None = Field(default=None, description="사용자 지정 스타일 템플릿")


class GeneratePostResponse(BaseModel):
    title: str
    location: str
    comment: str
    tags: list[str]

