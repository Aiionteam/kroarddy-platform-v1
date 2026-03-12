"""Photo selection router - v1."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import APIRouter, File, Header, HTTPException, UploadFile

from ...domain.v1.contracts import (
    EvaluationRequest,
    GeneratePostRequest,
    GeneratePostResponse,
    JobStatusResponse,
    UploadPhotosResponse,
    UploadPipelineJob,
    UploadedPhoto,
)
from ...domain.v1.state import store, worker


router = APIRouter(prefix="/photo-selection", tags=["photo-selection"])
service_root = Path(__file__).resolve().parents[3]
uploads_dir = service_root / "artifacts" / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)

_MBTI_TYPES = {
    "INTJ", "INTP", "ENTJ", "ENTP",
    "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISFJ", "ESTJ", "ESFJ",
    "ISTP", "ISFP", "ESTP", "ESFP",
}
_STYLE_TEMPLATE_FILE = service_root / "app" / "config" / "mbti_style_templates.json"
_DEFAULT_STYLE_GUIDES: dict[str, str] = {
    "AUTO": (
        "대중적인 인스타 여행 피드 톤. "
        "읽기 쉬운 2~4문장, 과하지 않은 감성, 해시태그 3~5개를 사용한다."
    ),
    "ISFP": (
        "감성적이고 미니멀한 톤. 짧은 문장과 여백을 사용하고, "
        "잔잔한 무드의 단어를 넣는다. 이모지는 1~2개만 사용한다."
    ),
    "ISTP": (
        "간결하고 쿨한 톤. 핵심 장면과 사실 위주로 서술하며 "
        "불필요한 수식은 줄인다."
    ),
    "ENTP": (
        "에너지 있고 위트 있는 톤. 가벼운 질문이나 재치 있는 표현을 넣고, "
        "리듬감 있는 문장을 사용한다."
    ),
}


def _mbti_prompt_constraints(style_filter: str) -> str:
    # MBTI 문자 축을 이용해 톤 제약을 명시한다.
    if style_filter == "AUTO":
        return (
            "- 문장 길이: 짧은 2문장 + 해시태그 1줄\n"
            "- 이모지: 1개\n"
            "- 말투: 가벼운 반말 감성\n"
            "- 금지: 설명문/리뷰체/일기체 장문"
        )

    e_or_i = style_filter[0]
    s_or_n = style_filter[1]
    t_or_f = style_filter[2]
    j_or_p = style_filter[3]

    emoji_count = "0~1개" if t_or_f == "T" else "1~2개"
    sentence_len = "짧고 단호하게" if j_or_p == "J" else "리듬감 있게"
    tone = "팩트/핵심 중심" if t_or_f == "T" else "감정/무드 중심"
    intro = "바로 핵심부터" if e_or_i == "E" else "한 박자 여유 있게 시작"
    detail = "장면/디테일 위주" if s_or_n == "S" else "의미/인상 위주"

    return (
        f"- 문장 길이: {sentence_len} 2문장 + 해시태그 1줄\n"
        f"- 이모지: {emoji_count}\n"
        f"- 첫 문장 시작: {intro}\n"
        f"- 본문 포커스: {tone}, {detail}\n"
        "- 금지: '~했어요/했습니다' 중심의 블로그 문체, 과도한 배경설명, 중복 수식"
    )


def _tone_bucket(style_filter: str) -> str:
    if style_filter in {"ISFP", "INFP", "INFJ"}:
        return "emotional"
    if style_filter in {"ESTJ", "ISTJ", "ENTJ"}:
        return "info"
    if style_filter in {"ENTP", "ESTP", "ESFP", "ENFP"}:
        return "trendy"
    return "default"


def _few_shot_example(style_filter: str) -> str:
    bucket = _tone_bucket(style_filter)
    if bucket == "emotional":
        return (
            '출력(JSON): {"title":"윤슬 한 장","location":"부산 해운대","line1":"부산, 여름 조각 🌊",'
            '"line2":"걷기만 해도 기분 풀림.","tags":["여름이었다","바다멍","여행기록"]}'
        )
    if bucket == "info":
        return (
            '출력(JSON): {"title":"부산 핵심 요약","location":"부산","line1":"부산 2박3일, 동선 끝.",'
            '"line2":"씨앗호떡-해운대-광안리 추천.","tags":["부산여행","핵심코스","주말여행"]}'
        )
    if bucket == "trendy":
        return (
            '출력(JSON): {"title":"오늘도 부산 찢음","location":"부산","line1":"부산 안 오면 손해 🥘",'
            '"line2":"밤바다 코스까지 완-벽.","tags":["먹스타그램","부산핫플","여행중"]}'
        )
    return (
        '출력(JSON): {"title":"여행 한 컷 저장","location":"어딘가의 여행지","line1":"오늘 무드, 저장 📸",'
        '"line2":"걷고 보니 하루 순삭.","tags":["여행기록","감성스냅","오늘의무드"]}'
    )


def _normalize_instagram_comment(line1: str, line2: str, fallback: str) -> str:
    def clip_line(s: str, limit: int = 30) -> str:
        s = re.sub(r"\s+", " ", s).strip()
        if len(s) <= limit:
            return s
        return s[:limit].rstrip() + "…"

    def to_casual(line: str) -> str:
        s = line.strip()
        # 블로그/존댓말 종결을 인스타 감성의 반말/명사형으로 보정
        direct_replacements = [
            ("했습니다", "했음"),
            ("했어요", "했음"),
            ("입니다", "임"),
            ("이에요", "임"),
            ("예요", "임"),
            ("좋았어요", "좋았음"),
            ("좋았습니다", "좋았음"),
            ("같아요", "같음"),
            ("있어요", "있음"),
        ]
        for src, dst in direct_replacements:
            s = s.replace(src, dst)

        replacements = [
            (r"합니다([.!?…]?)$", r"함\1"),
            (r"했습니다([.!?…]?)$", r"했음\1"),
            (r"했어요([.!?…]?)$", r"했음\1"),
            (r"였습니다([.!?…]?)$", r"였음\1"),
            (r"이에요([.!?…]?)$", r"임\1"),
            (r"예요([.!?…]?)$", r"임\1"),
            (r"입니다([.!?…]?)$", r"임\1"),
            (r"좋았습니다([.!?…]?)$", r"좋았음\1"),
            (r"좋았어요([.!?…]?)$", r"좋았음\1"),
            (r"같아요([.!?…]?)$", r"같음\1"),
            (r"있어요([.!?…]?)$", r"있음\1"),
        ]
        for pattern, repl in replacements:
            s = re.sub(pattern, repl, s)
        return s

    main_line = to_casual(line1.strip() or fallback)
    detail_line = to_casual(line2.strip() or "짧게 남기는 오늘의 여행 무드.")
    main_line = clip_line(main_line, 18)  # 첫 줄은 짧고 강하게
    detail_line = clip_line(detail_line, 30)
    return f"{main_line}\n\n{detail_line}"


def _normalize_style_filter(style_filter: str | None) -> str:
    value = (style_filter or "AUTO").strip().upper()
    if value in _MBTI_TYPES:
        return value
    return "AUTO"


def _load_style_templates() -> dict[str, str]:
    templates = dict(_DEFAULT_STYLE_GUIDES)
    if not _STYLE_TEMPLATE_FILE.exists():
        return templates
    try:
        parsed = json.loads(_STYLE_TEMPLATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return templates
    if not isinstance(parsed, dict):
        return templates
    for key, value in parsed.items():
        k = str(key).strip().upper()
        if k not in _MBTI_TYPES and k != "AUTO":
            continue
        v = str(value).strip()
        if v:
            templates[k] = v
    return templates


def _build_style_guide(style_filter: str, style_template: str | None) -> tuple[str, str]:
    normalized = _normalize_style_filter(style_filter)
    # 사용자가 직접 템플릿을 넘기면 최우선 사용
    if style_template and style_template.strip():
        return normalized, style_template.strip()

    templates = _load_style_templates()
    if normalized in templates:
        return normalized, templates[normalized]
    return normalized, templates["AUTO"]


def _extract_json_object(text: str) -> dict:
    text = text.strip()
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return {}
    try:
        parsed = json.loads(match.group(0))
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _generate_post_with_gpt(
    comment: str,
    style_filter: str | None = None,
    style_template: str | None = None,
) -> GeneratePostResponse:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured.")

    normalized_filter, style_guide = _build_style_guide(style_filter or "AUTO", style_template)
    hard_constraints = _mbti_prompt_constraints(normalized_filter)
    system_prompt = (
        "너는 한국 20대 여행 인스타 인플루언서의 카피라이터다. "
        "사용자 메모를 인스타 피드 톤으로 변환한다. "
        "반드시 JSON 객체만 출력하고, 키는 title/location/line1/line2/tags만 사용한다. "
        "규칙: "
        "1) 블로그 문체(~했어요/~했습니다/~입니다) 사용 시 실패다. "
        "2) title은 8~18자, 시선을 끄는 문구(이모지 0~1개). "
        "3) location은 코멘트에서 유추 가능하면 구체적으로, 불가하면 '어딘가의 여행지'. "
        "4) line1은 10~18자, 강한 훅 1줄. "
        "5) line2는 12~30자, 주어 생략 위주로 간결하게. "
        "6) 복문/배경설명/정보문단 금지. "
        "7) style 가이드를 엄격히 반영한다. "
        "8) tags는 해시 기호 없이 3~5개. "
        "9) 입력 문장을 그대로 복붙하지 말고 무드 중심으로 재작성한다. "
        "10) line1/line2 외에 긴 본문 필드는 만들지 마라."
    )
    user_prompt = (
        f"style_filter: {normalized_filter}\n"
        f"style_guide: {style_guide}\n\n"
        f"[MBTI 제약]\n{hard_constraints}\n\n"
        "Few-shot 예시:\n"
        "입력: 부산 해운대 2박3일, 친구랑 여행, 씨앗호떡 맛있음, 밤바다 예쁨\n"
        f"{_few_shot_example(normalized_filter)}\n\n"
        f"한줄 코멘트: {comment}\n"
        "인스타 피드용으로 작성해줘."
    )

    body = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_completion_tokens": 300,
    }
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    with httpx.Client(timeout=20.0) as client:
        res = client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=body)
        res.raise_for_status()
        data = res.json()

    choices = data.get("choices") or []
    content = ""
    if choices:
        message = choices[0].get("message") or {}
        content = str(message.get("content") or "")

    parsed = _extract_json_object(content)
    title = str(parsed.get("title") or "").strip() or "오늘의 여행 한 컷"
    location = str(parsed.get("location") or "").strip() or "어딘가의 여행지"
    line1 = str(parsed.get("line1") or "").strip()
    line2 = str(parsed.get("line2") or "").strip()
    raw_comment = str(parsed.get("comment") or "").strip()
    fallback_base = comment.strip() or "여행의 소중한 순간을 기록합니다."
    if not line1 or not line2:
        pieces = [line.strip() for line in raw_comment.splitlines() if line.strip()]
        if not line1 and pieces:
            line1 = pieces[0]
        if not line2 and len(pieces) > 1:
            line2 = pieces[1]
    out_comment = _normalize_instagram_comment(line1, line2, f"{fallback_base} 📸")
    tags_raw = parsed.get("tags")
    tags: list[str] = []
    if isinstance(tags_raw, list):
        tags = [str(t).strip().lstrip("#") for t in tags_raw if str(t).strip()][:5]
    if len(tags) < 3:
        bucket = _tone_bucket(normalized_filter)
        if bucket == "info":
            tags = ["여행요약", "핵심코스", "주말여행"]
        elif bucket == "trendy":
            tags = ["여행중", "핫플기록", "먹스타그램"]
        else:
            tags = ["여행기록", "감성여행", "추억한컷"]

    hashtag_line = " ".join(f"#{tag}" for tag in tags[:5])
    if hashtag_line not in out_comment:
        out_comment = f"{out_comment}\n\n{hashtag_line}"

    return GeneratePostResponse(title=title, location=location, comment=out_comment, tags=tags)


@router.post("/jobs", response_model=JobStatusResponse)
def create_job(req: EvaluationRequest, idempotency_key: str | None = Header(default=None)) -> JobStatusResponse:
    if idempotency_key:
        existing = store.get_by_idempotency_key(idempotency_key)
        if existing is not None:
            return existing

    job_id = uuid4().hex
    job = JobStatusResponse(
        job_id=job_id,
        status="queued",
        requested_at=datetime.now(),
        max_retries=req.max_retries,
    )
    store.put(job, idempotency_key=idempotency_key)
    worker.enqueue(job_id, req)
    return job


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
def get_job(job_id: str) -> JobStatusResponse:
    job = store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    return job


@router.post("/uploads", response_model=UploadPhotosResponse)
async def upload_photos(files: list[UploadFile] = File(...)) -> UploadPhotosResponse:
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    batch_id = datetime.now().strftime("%Y%m%d_%H%M%S") + f"_{uuid4().hex[:8]}"
    batch_dir = uploads_dir / batch_id
    batch_dir.mkdir(parents=True, exist_ok=True)

    saved: list[UploadedPhoto] = []
    for file in files:
        content = await file.read()
        if not content:
            continue

        content_type = (file.content_type or "").lower()
        allowed_types = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/gif": "gif",
            "image/webp": "webp",
            "image/bmp": "bmp",
        }
        ext = allowed_types.get(content_type)
        if ext is None:
            raise HTTPException(status_code=400, detail=f"Unsupported image type: {file.filename}")

        name = f"{uuid4().hex}.{ext}"
        dst = batch_dir / name
        dst.write_bytes(content)

        saved.append(
            UploadedPhoto(
                name=file.filename or name,
                url=f"/tourstar-files/uploads/{batch_id}/{name}",
                size=len(content),
            )
        )

    if not saved:
        raise HTTPException(status_code=400, detail="No valid image files uploaded.")

    # 업로드 완료 후 즉시 사진 판독 파이프라인 큐잉
    job_id = uuid4().hex
    job = JobStatusResponse(
        job_id=job_id,
        status="queued",
        requested_at=datetime.now(),
        max_retries=1,
    )
    store.put(job)
    worker.enqueue(
        job_id,
        EvaluationRequest(
            input_dir=str(batch_dir),
            top_k=min(3, len(saved)),
            max_images=len(saved),
        ),
    )

    return UploadPhotosResponse(
        uploaded=saved,
        batch_dir=str(batch_dir),
        pipeline_job=UploadPipelineJob(job_id=job_id, status="queued"),
    )


@router.post("/generate-post", response_model=GeneratePostResponse)
def generate_post(req: GeneratePostRequest) -> GeneratePostResponse:
    return _generate_post_with_gpt(req.comment, req.style_filter, req.style_template)

