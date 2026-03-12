"""NudeNet 기반 NSFW 이미지 필터 파이프라인.

흐름:
  1. FastAPI 엔드포인트가 UploadFile 바이트를 이 모듈로 전달
  2. check_nsfw_async() → 스레드풀에서 NudeNet 감지 실행 (이벤트루프 블로킹 방지)
  3. NSFW 레이블이 임계값 이상이면 is_safe=False 반환 → 엔드포인트가 400 응답

NOTE:
- NudeNet 첫 실행 시 ONNX 모델 (~550 MB) 을 자동으로 다운로드합니다.
  Docker 빌드 시 오래 걸릴 수 있으므로, Dockerfile 에서
    RUN python -c "from nudenet import NudeDetector; NudeDetector()"
  를 추가해 미리 다운로드하는 것을 권장합니다.
- nudenet 은 동기 감지(sync)이므로 run_in_executor 로 실행합니다.
"""
import asyncio
import logging
import os
import tempfile

logger = logging.getLogger(__name__)

# ── 차단할 NSFW 레이블 (nudenet v3 기준) ─────────────────────────────────
NSFW_LABELS: frozenset[str] = frozenset({
    "FEMALE_GENITALIA_EXPOSED",
    "MALE_GENITALIA_EXPOSED",
    "FEMALE_BREAST_EXPOSED",
    "BUTTOCKS_EXPOSED",
    "ANUS_EXPOSED",
})

# 이 점수 이상일 때 차단 (0~1, 낮출수록 민감도 ↑)
NSFW_THRESHOLD: float = 0.60

# ── 싱글톤 감지기 (프로세스 내 한 번만 로드) ──────────────────────────────
_detector = None
_detector_error: Exception | None = None


def _get_detector():
    """NudeDetector 싱글톤 반환. 로드 실패 시 None."""
    global _detector, _detector_error
    if _detector is not None:
        return _detector
    if _detector_error is not None:
        return None
    try:
        from nudenet import NudeDetector  # noqa: PLC0415
        _detector = NudeDetector()
        logger.info("NudeNet 모델 로드 완료")
    except Exception as exc:
        _detector_error = exc
        logger.error("NudeNet 로드 실패 (필터 비활성화): %s", exc)
    return _detector


# ── 동기 감지 함수 (스레드풀에서 실행) ────────────────────────────────────

def _check_sync(image_bytes: bytes) -> dict:
    """
    이미지 바이트를 임시 파일로 저장 후 NudeNet 감지.
    nudenet v3 detect() 는 파일 경로를 받습니다.
    """
    detector = _get_detector()
    if detector is None:
        # 모델 로드 실패 → 안전 통과 (서비스 중단 방지)
        return {"is_safe": True, "nsfw_score": 0.0, "detected_labels": []}

    # 임시 파일에 저장 (nudenet 이 경로 기반으로 처리)
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(image_bytes)
        tmp_path = tmp.name

    try:
        detections: list[dict] = detector.detect(tmp_path)
    except Exception as exc:
        logger.exception("NudeNet 감지 중 오류: %s", exc)
        return {"is_safe": True, "nsfw_score": 0.0, "detected_labels": []}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    # NSFW 레이블 필터링
    nsfw_hits = [
        d for d in detections
        if d.get("class") in NSFW_LABELS and d.get("score", 0.0) >= NSFW_THRESHOLD
    ]

    if nsfw_hits:
        max_score = max(d["score"] for d in nsfw_hits)
        labels = sorted({d["class"] for d in nsfw_hits})
        logger.warning("NSFW 감지: score=%.3f labels=%s", max_score, labels)
        return {
            "is_safe": False,
            "nsfw_score": round(float(max_score), 3),
            "detected_labels": labels,
        }

    # 전체 감지 중 최고 점수 (참고용)
    all_max = max((d.get("score", 0.0) for d in detections), default=0.0)
    return {
        "is_safe": True,
        "nsfw_score": round(float(all_max), 3),
        "detected_labels": [],
    }


# ── 비동기 공개 API ────────────────────────────────────────────────────────

async def check_nsfw_async(image_bytes: bytes) -> dict:
    """
    비동기 NSFW 검사. CPU 바운드 작업을 스레드풀로 위임합니다.

    Returns:
        {
            "is_safe": bool,
            "nsfw_score": float,       # 0.0 ~ 1.0
            "detected_labels": list    # 감지된 NSFW 레이블 목록
        }
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _check_sync, image_bytes)
