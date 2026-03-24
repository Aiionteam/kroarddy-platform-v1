"""뉴스 API 라우터."""
import asyncio

from fastapi import APIRouter, Query

from app.services import database as db
from app.services.crawler import CATEGORY_LABELS, RSS_FEEDS, get_news
from app.services.analyzer import _is_overseas

router = APIRouter(prefix="/api/v1/news", tags=["news"])


def _is_ok(item: dict) -> bool:
    """해외 기사가 아니면 True."""
    return not _is_overseas(item.get("title", ""), item.get("summary", ""))


@router.get("/processed", summary="GPT 선정 Top10 + 나머지 뉴스")
async def get_processed(
    limit_rest: int = Query(0, ge=0, le=100, description="나머지 기사 최대 수 (0=Top10만)"),
):
    """DB에 저장된 GPT 분석 결과 반환 (Top10 + 나머지). 해외 기사 실시간 제거 후 10개 보장."""
    loop = asyncio.get_event_loop()
    # 해외 필터 후 빈 자리를 채울 수 있도록 rest를 넉넉히(30개) 가져옴
    result = await loop.run_in_executor(None, lambda: db.get_processed_news(max(limit_rest, 30)))

    # ── Top10 구성: 기존 is_top10 기사 우선, 부족하면 rest에서 보충 ──
    top10: list[dict] = [item for item in result["top10"] if _is_ok(item)]
    if len(top10) < 10:
        top10_ids = {item["id"] for item in top10}
        backup = [
            item for item in result["rest"]
            if _is_ok(item) and item["id"] not in top10_ids
        ]
        needed = 10 - len(top10)
        top10.extend(backup[:needed])

    top10 = top10[:10]
    for new_rank, item in enumerate(top10, 1):
        item["top10_rank"] = new_rank

    # ── rest: top10에 포함된 기사 제외 후 limit_rest 수만큼 ──
    top10_ids = {item["id"] for item in top10}
    rest = [item for item in result["rest"] if item["id"] not in top10_ids][:limit_rest]

    return {
        "top10": top10,
        "rest":  rest,
        "top10_count": len(top10),
        "rest_count":  len(rest),
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
