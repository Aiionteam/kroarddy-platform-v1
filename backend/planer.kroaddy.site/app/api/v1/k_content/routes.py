"""K컨텐츠 플래너 API 라우터 – K-Content 하이브리드 일정 생성."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.k_content.graph import k_content_graph
from app.api.v1.standard.routes import save_plan
from app.api.v1.standard.schemas import SavePlanRequest
from app.core.database.session import get_db
from app.services.news_client import fetch_news_top10

router = APIRouter(prefix="/api/v1/k-content", tags=["k-content"])


class KContentGenerateRequest(BaseModel):
    package_id: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location_name: Optional[str] = None
    user_profile: Optional[Dict[str, Any]] = None
    news_top10: Optional[list] = None  # 프론트에서 전달한 뉴스 Top10 (없으면 직접 fetch)


class KContentSaveRequest(BaseModel):
    """K-Content 결과를 기존 standard 저장 포맷으로 매핑하기 위한 요청."""

    package_meta: Dict[str, Any]
    schedule: list[Dict[str, Any]]
    places: Optional[list[Dict[str, Any]]] = None
    cost_summary: Optional[Dict[str, Any]] = None

    user_id: Optional[int] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


def _build_route_name_from_package_meta(meta: Dict[str, Any]) -> str:
    return (
        (meta.get("title_ko") if isinstance(meta.get("title_ko"), str) else None)
        or (meta.get("title_en") if isinstance(meta.get("title_en"), str) else None)
        or (meta.get("package_id") if isinstance(meta.get("package_id"), str) else None)
        or "K-Content Route"
    )


def _map_k_content_schedule(
    schedule: list[Dict[str, Any]],
    *,
    package_meta: Dict[str, Any],
    places: Optional[list[Dict[str, Any]]],
    cost_summary: Optional[Dict[str, Any]],
) -> list[Dict[str, Any]]:
    """기존 travel_plans.schedule(JSON list)에 손실 없이 저장되도록 매핑.

    - 원본 일정 항목은 그대로 유지
    - K-Content 전용 메타(package_meta/places/cost_summary)는 첫 항목에 _k_content로 주입
      (스키마 변경 없이 JSON 필드만 활용)
    """
    mapped = [dict(item) for item in (schedule or [])]
    payload = {
        "package_meta": package_meta,
        "places": places or [],
        "cost_summary": cost_summary,
    }

    if mapped and isinstance(mapped[0], dict):
        mapped[0]["_k_content"] = payload
    else:
        mapped.append({"_k_content": payload})
    return mapped


@router.get("/health", summary="K컨텐츠 플래너 상태 확인")
async def health():
    return {"status": "ok"}


@router.post("/generate", summary="K-Content 하이브리드 일정 생성")
async def generate_k_itinerary(req: KContentGenerateRequest):
    try:
        # 뉴스 Top10: 프론트에서 이미 가져온 데이터가 있으면 재사용, 없으면 직접 fetch
        news_top10 = req.news_top10 if req.news_top10 else await fetch_news_top10(req.start_date, req.end_date)

        # LangGraph State: KContentState(KContent agent)에서 필요한 키만 넣습니다.
        initial_state = {
            "package_id": req.package_id,
            "location_name": req.location_name or "",
            "location": req.location_name or "",
            "start_date": req.start_date,
            "end_date": req.end_date,
            "user_profile": req.user_profile or {},
            "news_top10": news_top10,
        }

        result = await k_content_graph.ainvoke(initial_state)

        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])

        return {
            "success": True,
            "package_meta": result.get("package_meta"),
            "schedule": result.get("schedule"),
            # DB 앵커 + Gemini 외부 추천을 합친 최종 장소 목록
            "places": result.get("places"),
            "external_places": result.get("external_places"),
            "cost_summary": result.get("cost_summary"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent Error: {str(e)}")


@router.post("/save", summary="K-Content 일정 저장(기존 standard 저장 로직 재사용)")
async def save_k_content(
    req: KContentSaveRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        route_name = _build_route_name_from_package_meta(req.package_meta)
        location = req.location or "K-Content"
        mapped_schedule = _map_k_content_schedule(
            req.schedule,
            package_meta=req.package_meta,
            places=req.places,
            cost_summary=req.cost_summary,
        )

        # 기존 standard 저장 로직을 그대로 호출 (DB 스키마/저장함수 재사용)
        save_req = SavePlanRequest(
            location=location,
            route_name=route_name,
            start_date=req.start_date,
            end_date=req.end_date,
            schedule=mapped_schedule,
            user_id=req.user_id,
        )
        saved = await save_plan(save_req, db)
        return {
            "success": True,
            "route_name": route_name,
            **saved,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"K-Content Save Error: {str(e)}")
