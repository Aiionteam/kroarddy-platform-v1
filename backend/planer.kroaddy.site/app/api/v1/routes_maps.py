"""네이버 Maps API 프록시 라우터 – Geocoding / Static Map / Directions 15."""
import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

from app.services.naver_map_client import fetch_static_map, geocode, get_directions, keyword_search

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/maps", tags=["maps"])


# ──────────────────────────────────────────────────────────────
# Geocoding
# ──────────────────────────────────────────────────────────────
@router.get("/geocode", summary="장소명/주소 → 좌표 변환 (네이버 Geocoding)")
async def geocode_place(query: str = Query(..., description="검색할 장소명 또는 주소")):
    result = await geocode(query)
    if not result:
        raise HTTPException(status_code=404, detail=f"'{query}'에 대한 위치 정보를 찾을 수 없습니다.")
    return result


# ──────────────────────────────────────────────────────────────
# Place Search (장소명 → 좌표, Naver 지역 검색 API)
# ──────────────────────────────────────────────────────────────
@router.get("/place-search", summary="장소명 → 좌표 변환 (Naver 지역 검색 API)")
async def place_search(query: str = Query(..., description="검색할 장소명")):
    """주소 기반 Geocoding과 달리 장소명·상호명으로 좌표를 검색합니다."""
    result = await keyword_search(query)
    if not result:
        raise HTTPException(status_code=404, detail=f"'{query}'의 위치 정보를 찾을 수 없습니다.")
    return result


# ──────────────────────────────────────────────────────────────
# Static Map (서버 프록시 – ID/KEY 헤더 인증)
# ──────────────────────────────────────────────────────────────
@router.get("/static-map", summary="네이버 Static Map 이미지 프록시")
async def static_map(
    lat: float = Query(..., description="위도"),
    lng: float = Query(..., description="경도"),
    w: int   = Query(400, ge=50, le=800, description="가로 크기(px)"),
    h: int   = Query(300, ge=50, le=600, description="세로 크기(px)"),
    zoom: int = Query(15, ge=6, le=20, description="줌 레벨"),
):
    image_bytes = await fetch_static_map(lat=lat, lng=lng, width=w, height=h, zoom=zoom)
    if not image_bytes:
        raise HTTPException(status_code=502, detail="지도 이미지를 불러오지 못했습니다.")
    return Response(content=image_bytes, media_type="image/jpeg")


# ──────────────────────────────────────────────────────────────
# Directions 15 (실제 도로 경로)
# ──────────────────────────────────────────────────────────────
class CoordItem(BaseModel):
    lng: float
    lat: float


class DirectionsRequest(BaseModel):
    start: CoordItem
    goal: CoordItem
    waypoints: list[CoordItem] = []


@router.post("/directions", summary="Directions 15 – 실제 도로 경로 조회")
async def get_route_directions(body: DirectionsRequest):
    """start → waypoints → goal 순서로 실제 도로 경로 좌표 배열 반환.

    waypoints는 최대 15개 (Directions 15 제한).
    Returns: {"path": [[lng, lat], ...]}
    """
    wp = [(w.lng, w.lat) for w in body.waypoints] if body.waypoints else None

    path = await get_directions(
        start_lng=body.start.lng,
        start_lat=body.start.lat,
        goal_lng=body.goal.lng,
        goal_lat=body.goal.lat,
        waypoints=wp,
    )

    if path is None:
        raise HTTPException(status_code=502, detail="경로를 계산할 수 없습니다.")

    return {"path": path}
