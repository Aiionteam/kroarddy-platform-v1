"""K컨텐츠 플래너 API 라우터 – K-Content 하이브리드 일정 생성."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agent.k_content.graph import k_content_graph
from app.agent.k_content.nodes import _is_daily_quota
from app.api.v1.k_content.schemas import (
    KContentCategory,
    KContentGenerateRequest,
    KContentPackageResponse,
    KContentPackagesListResponse,
    KContentPlaceResponse,
    KContentSaveRequest,
    build_legacy_package_id,
    parse_package_ref_to_db_id,
)
from app.api.v1.standard.routes import save_plan
from app.api.v1.standard.schemas import SavePlanRequest
from app.core.database.session import get_db
from app.models.k_content import KContentPackage
from app.services.news_client import fetch_news_top10

router = APIRouter(prefix="/api/v1/k-content", tags=["k-content"])


def _check_quota_error(e: Exception) -> None:
    """Gemini/AI 에러를 사용자 친화적 HTTP 예외로 변환."""
    msg = str(e)

    # Semaphore 대기 타임아웃 → 503 (서버 과부하)
    if "AI 서버가 바쁩니다" in msg:
        raise HTTPException(status_code=503, detail=msg)

    if "429" not in msg and "RESOURCE_EXHAUSTED" not in msg:
        return
    if _is_daily_quota(e):
        raise HTTPException(
            status_code=429,
            detail="오늘의 AI 사용량이 초과됐습니다. 내일 다시 시도해 주세요. (무료 티어 일일 한도)",
        )
    raise HTTPException(
        status_code=429,
        detail="AI 요청이 잠시 몰렸습니다. 몇 초 후 다시 시도해 주세요.",
    )


def _build_route_name_from_package_meta(meta: Dict[str, Any]) -> str:
    return (
        (meta.get("title_ko") if isinstance(meta.get("title_ko"), str) else None)
        or (meta.get("title_en") if isinstance(meta.get("title_en"), str) else None)
        or (str(meta.get("id")) if isinstance(meta.get("id"), int) else None)
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


def _to_place_response(place: Any) -> KContentPlaceResponse:
    return KContentPlaceResponse(
        id=place.id,
        package_id=place.package_id,
        name_en=place.name_en,
        name_ko=place.name_ko,
        lat=float(place.lat),
        lng=float(place.lng),
        description_en=place.description_en,
        must_do_en=place.must_do_en,
    )


def _to_package_response(pkg: Any, *, include_places: bool = False) -> KContentPackageResponse:
    return KContentPackageResponse(
        id=pkg.id,
        package_id=build_legacy_package_id(db_id=pkg.id, category=pkg.category),
        category=pkg.category,
        title_en=pkg.title_en,
        title_ko=pkg.title_ko,
        description_en=pkg.description_en,
        image_url=pkg.image_url,
        tags=pkg.tags,
        places=[_to_place_response(p) for p in (pkg.places or [])] if include_places else [],
    )


@router.get("/health", summary="K컨텐츠 플래너 상태 확인")
async def health():
    return {"status": "ok"}


@router.get("/packages", response_model=KContentPackagesListResponse, summary="K-Content 패키지 목록 조회")
async def list_k_content_packages(
    category: Optional[KContentCategory] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    query = select(KContentPackage).order_by(KContentPackage.id.asc())
    if category:
        query = query.where(KContentPackage.category == category)
    rows = (await db.execute(query)).scalars().all()
    items = [_to_package_response(pkg) for pkg in rows]
    return KContentPackagesListResponse(items=items, total=len(items))


@router.get(
    "/packages/{package_ref}",
    response_model=KContentPackageResponse,
    summary="K-Content 패키지 상세 조회 (id 또는 package_id)",
)
async def get_k_content_package(package_ref: str, db: AsyncSession = Depends(get_db)):
    pkg = None
    if package_ref.isdigit():
        pkg = await db.get(
            KContentPackage,
            int(package_ref),
            options=[selectinload(KContentPackage.places)],
        )

    if pkg is None:
        candidates = (
            await db.execute(
                select(KContentPackage)
                .options(selectinload(KContentPackage.places))
                .order_by(KContentPackage.id.asc())
            )
        ).scalars().all()
        target = package_ref.upper()
        for row in candidates:
            if build_legacy_package_id(db_id=row.id, category=row.category).upper() == target:
                pkg = row
                break

    if pkg is None:
        raise HTTPException(status_code=404, detail=f"package not found: {package_ref}")

    return _to_package_response(pkg, include_places=True)


@router.post("/generate", summary="K-Content 하이브리드 일정 생성")
async def generate_k_itinerary(req: KContentGenerateRequest):
    try:
        resolved_package_id = parse_package_ref_to_db_id(req.package_id)
        if not resolved_package_id:
            raise HTTPException(status_code=422, detail=f"invalid package_id: {req.package_id}")

        # 뉴스 Top10: 프론트에서 이미 가져온 데이터가 있으면 재사용, 없으면 직접 fetch
        news_top10 = req.news_top10 if req.news_top10 else await fetch_news_top10(req.start_date, req.end_date)

        # LangGraph State: KContentState(KContent agent)에서 필요한 키만 넣습니다.
        initial_state = {
            "package_id": resolved_package_id,
            "location_name": req.location_name or "",
            "location": req.location_name or "",
            "start_date": req.start_date,
            "end_date": req.end_date,
            "user_profile": req.user_profile or {},
            "news_top10": news_top10,
        }

        result = await k_content_graph.ainvoke(initial_state)

        if result.get("error"):
            _check_quota_error(Exception(result["error"]))
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
        _check_quota_error(e)
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
