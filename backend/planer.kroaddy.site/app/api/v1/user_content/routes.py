"""유저 컨텐츠 플래너 API – AI 폴리시 + S3 presigned URL + 루트 CRUD."""
import json
import logging
import re

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database.session import get_db
from app.core.nsfw_filter import check_nsfw_async
from app.core.storage import generate_presigned_upload_url
from app.models.user_content_route import UserContentRoute
from .schemas import (
    PolishRequest,
    PolishResponse,
    PresignedUrlRequest,
    PresignedUrlResponse,
    SaveRouteRequest,
    ValidateImageResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/user-content", tags=["user-content"])


# ── AI 폴리시 헬퍼 ────────────────────────────────────────────

def _get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model="gpt-5-mini",
        temperature=0.5,
        api_key=settings.openai_api_key,
    )


def _parse_json(raw: str) -> dict:
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text.strip())


async def _ai_polish(req: PolishRequest) -> dict:
    """유저 입력을 여행 카드용 콘텐츠로 정제."""
    items_text = "\n".join(
        f"  {i+1}. {item.place}" + (f" - {item.note}" if item.note else "")
        for i, item in enumerate(req.route_items)
    )
    user_desc = req.description or ""

    prompt = (
        f"여행지: {req.location}\n"
        f"유저가 입력한 루트 제목: {req.title}\n"
        f"유저 설명: {user_desc}\n"
        f"루트 장소 목록:\n{items_text}\n\n"
        "위 내용을 여행 추천 카드로 다듬어주세요. 규칙:\n"
        "- title: 감성적이고 매력적인 한국어 제목 (20자 이내)\n"
        "- description: 이 루트의 매력을 설명하는 한국어 소개 (80자 이내)\n"
        "- route_items: 각 장소를 아래 형식으로 정제 (description 30자이내, tip 20자이내)\n"
        "- tags: 이 루트를 표현하는 해시태그 3~5개 (예: #야경투어 #힐링 #맛집)\n"
        "- 실존하는 장소만 유지, 어색한 표현은 자연스럽게 다듬기\n\n"
        "아래 JSON 형식으로만 응답하세요 (다른 설명 없이):\n"
        '{"title":"제목","description":"소개","route_items":[{"order":1,"place":"장소명",'
        '"description":"한줄설명","tip":"여행팁"}],"tags":["#태그1","#태그2"]}'
    )

    llm = _get_llm()
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        content = response.content
        if isinstance(content, list):
            content = "".join(
                p if isinstance(p, str) else p.get("text", "") for p in content
            )
        data = _parse_json(content)
        logger.info("AI 폴리시 완료: %s → %s", req.title, data.get("title"))
        return data
    except Exception as e:
        logger.exception("AI 폴리시 실패: %s", e)
        raise HTTPException(status_code=500, detail=f"AI 폴리시 실패: {e}")


def _row_to_card(row: UserContentRoute) -> dict:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "title": row.title,
        "location": row.location,
        "description": row.description,
        "route_items": row.route_items or [],
        "tags": row.tags or [],
        "image_url": row.image_url,
        "likes": row.likes,
        "created_at": row.created_at.isoformat(),
    }


# ── 엔드포인트 ──────────────────────────────────────────────────

@router.post(
    "/upload-url",
    response_model=PresignedUrlResponse,
    summary="이미지 업로드용 S3 Presigned URL 발급 (NSFW 검증 없음)",
)
async def get_upload_url(req: PresignedUrlRequest):
    """
    프론트엔드가 이 URL을 통해 S3에 직접 PUT 업로드합니다.
    NSFW 필터 없이 단순 URL 발급이 필요할 때 사용하세요.
    일반 업로드 흐름에서는 /validate-image 를 사용하세요.
    """
    try:
        upload_url, image_url = generate_presigned_upload_url(req.content_type)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return PresignedUrlResponse(upload_url=upload_url, image_url=image_url)


@router.post(
    "/validate-image",
    response_model=ValidateImageResponse,
    summary="NSFW 이미지 필터 + S3 Presigned URL 발급 (권장 업로드 흐름)",
)
async def validate_image(file: UploadFile = File(...)):
    """
    이미지 업로드 파이프라인 (NudeNet → S3):

    1. 이미지 바이트를 NudeNet 으로 NSFW 검사
    2. 선정적 콘텐츠 감지 시 HTTP 400 반환 (업로드 차단)
    3. 안전한 이미지면 S3 presigned PUT URL + 공개 image_url 반환
    4. 프론트엔드는 반환된 upload_url 로 S3 에 직접 PUT 후
       image_url 을 /routes 저장 시 전달

    감지 레이블 (차단 기준 score ≥ 0.60):
      FEMALE_GENITALIA_EXPOSED / MALE_GENITALIA_EXPOSED /
      FEMALE_BREAST_EXPOSED / BUTTOCKS_EXPOSED / ANUS_EXPOSED
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")

    image_bytes = await file.read()

    # ── NudeNet 파이프라인 ────────────────────────────────────────
    result = await check_nsfw_async(image_bytes)

    if not result["is_safe"]:
        labels_kr = ", ".join(result["detected_labels"])
        raise HTTPException(
            status_code=400,
            detail=(
                f"선정적인 콘텐츠가 감지되어 업로드할 수 없습니다. "
                f"다른 사진을 사용해 주세요. (감지 항목: {labels_kr})"
            ),
        )

    # ── 안전한 이미지 → S3 presigned URL 발급 ─────────────────────
    try:
        upload_url, image_url = generate_presigned_upload_url(file.content_type)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    logger.info(
        "이미지 검증 통과: nsfw_score=%.3f content_type=%s",
        result["nsfw_score"],
        file.content_type,
    )
    return ValidateImageResponse(
        is_safe=True,
        nsfw_score=result["nsfw_score"],
        upload_url=upload_url,
        image_url=image_url,
    )


@router.post("/routes/polish", response_model=PolishResponse, summary="유저 입력 AI 폴리시")
async def polish_route(req: PolishRequest):
    """유저가 입력한 제목·장소 목록을 AI로 정제해 반환 (저장 없음)."""
    data = await _ai_polish(req)
    return PolishResponse(
        title=data.get("title", req.title),
        location=req.location,
        description=data.get("description", ""),
        route_items=data.get("route_items", []),
        tags=data.get("tags", []),
    )


@router.post("/routes", summary="유저 루트 저장")
async def save_route(req: SaveRouteRequest, db: AsyncSession = Depends(get_db)):
    row = UserContentRoute(
        user_id=req.user_id,
        title=req.title,
        location=req.location,
        description=req.description,
        route_items=req.route_items,
        tags=req.tags,
        image_url=req.image_url,
    )
    db.add(row)
    await db.flush()
    logger.info("유저 루트 저장: id=%s user=%s title=%s", row.id, req.user_id, req.title)
    return {"id": row.id, **_row_to_card(row)}


@router.get("/routes", summary="유저 루트 피드 목록")
async def list_routes(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserContentRoute)
        .order_by(UserContentRoute.likes.desc(), UserContentRoute.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = result.scalars().all()
    return {"routes": [_row_to_card(r) for r in rows], "total": len(rows)}


@router.get("/routes/{route_id}", summary="유저 루트 상세")
async def get_route(route_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserContentRoute).where(UserContentRoute.id == route_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="루트를 찾을 수 없습니다.")
    return _row_to_card(row)


@router.post("/routes/{route_id}/like", summary="루트 좋아요")
async def like_route(route_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserContentRoute).where(UserContentRoute.id == route_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="루트를 찾을 수 없습니다.")
    row.likes += 1
    await db.flush()
    return {"id": route_id, "likes": row.likes}


@router.delete("/routes/{route_id}", summary="유저 루트 삭제")
async def delete_route(route_id: int, user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserContentRoute).where(
            UserContentRoute.id == route_id,
            UserContentRoute.user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="루트를 찾을 수 없거나 삭제 권한이 없습니다.")
    await db.delete(row)
    await db.flush()
    return {"deleted": True, "id": route_id}


@router.get("/health", summary="유저 컨텐츠 상태 확인")
async def health():
    return {"status": "ok"}
