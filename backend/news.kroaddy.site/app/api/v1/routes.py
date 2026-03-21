"""뉴스 API 라우터."""
import asyncio

from fastapi import APIRouter, Query

from app.services import database as db
from app.services.crawler import CATEGORY_LABELS, RSS_FEEDS, get_news

router = APIRouter(prefix="/api/v1/news", tags=["news"])


@router.get("/processed", summary="GPT 선정 Top10 + 나머지 뉴스")
async def get_processed(
    limit_rest: int = Query(0, ge=0, le=100, description="나머지 기사 최대 수 (0=Top10만)"),
):
    """DB에 저장된 GPT 분석 결과 반환 (Top10 + 나머지)."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, lambda: db.get_processed_news(limit_rest))
    return {
        "top10": result["top10"],
        "rest":  result["rest"],
        "top10_count": len(result["top10"]),
        "rest_count":  len(result["rest"]),
    }


@router.get("", summary="원본 RSS 뉴스 목록 (캐시)")
async def list_news(
    category: str = Query("entertainment", description="카테고리"),
    limit: int = Query(20, ge=1, le=50),
):
    items = await get_news(category=category, limit=limit)
    return {
        "category":       category,
        "category_label": CATEGORY_LABELS.get(category, category),
        "total":          len(items),
        "items":          items,
    }


@router.get("/categories", summary="사용 가능한 카테고리 목록")
async def list_categories():
    return {
        "categories": [
            {"id": k, "label": v}
            for k, v in CATEGORY_LABELS.items()
            if k in RSS_FEEDS
        ]
    }
