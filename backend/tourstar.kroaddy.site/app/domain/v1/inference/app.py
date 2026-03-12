from __future__ import annotations

from fastapi import FastAPI

from .contracts import (
    CompletenessResponse,
    DetectResponse,
    FullInferenceRequest,
    FullInferenceResponse,
    InferenceRequest,
    QualityResponse,
)
from .service import InferenceService


app = FastAPI(title="Tourstar Inference Service", version="0.1.0")
service = InferenceService()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/inference/detect", response_model=DetectResponse)
def detect(req: InferenceRequest) -> DetectResponse:
    row = service.infer_full(FullInferenceRequest(**req.model_dump()))
    return DetectResponse(
        image_path=req.image_path,
        person_count=int(row.get("person_count", 0)),
        composition_score=float(row.get("composition_score", 0.0)),
    )


@app.post("/v1/inference/quality", response_model=QualityResponse)
def quality(req: InferenceRequest) -> QualityResponse:
    row = service.infer_full(FullInferenceRequest(**req.model_dump()))
    return QualityResponse(
        image_path=req.image_path,
        blur_aux_score=float(row.get("blur_aux_score", 0.0)),
        tone_score=float(row.get("tone_score", 0.0)),
        quality_score=float(row.get("quality_score", 0.0)),
        musiq_raw=float(row.get("musiq_raw", 0.0)),
        musiq_norm=float(row.get("musiq_norm", 0.0)),
        musiq_device=str(row.get("musiq_device", "")),
    )


@app.post("/v1/inference/completeness", response_model=CompletenessResponse)
def completeness(req: InferenceRequest) -> CompletenessResponse:
    row = service.infer_full(FullInferenceRequest(**req.model_dump()))
    return CompletenessResponse(
        image_path=req.image_path,
        subject_completeness_score=float(row.get("subject_completeness_score", 0.0)),
    )


@app.post("/v1/inference/full", response_model=FullInferenceResponse)
def full(req: FullInferenceRequest) -> FullInferenceResponse:
    row = service.infer_full(req)
    return FullInferenceResponse(row=row)


