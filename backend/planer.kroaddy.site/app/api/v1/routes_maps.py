"""네이버 Maps API 프록시 라우터 – Geocoding / Static Map / Directions 15."""
import logging
from math import atan2, cos, radians, sin, sqrt

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


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 좌표 사이 직선거리(m) – Haversine 공식."""
    R = 6_371_000
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


# Directions API 실패 시 반환하는 fallback 응답.
# 5xx 대신 200으로 반환하여 브라우저 콘솔 에러를 방지하고,
# 프론트엔드가 직선 경로(fallback)로 자동 전환하도록 한다.
_DIRECTIONS_FALLBACK = {
    "path": [],
    "summary": {"distance": 0, "duration": 0},
    "fallback": True,
}

# 한국 영토 좌표 범위 (근사치) – 이 범위 밖 좌표는 geocoding 실패로 간주
_KOREA_LAT = (33.0, 38.7)
_KOREA_LNG = (124.5, 132.0)


def _is_valid_korea_coord(lat: float, lng: float) -> bool:
    """좌표가 한국 범위 내 유효한 값인지 검증."""
    if lat == 0.0 or lng == 0.0:
        return False  # geocoding 실패로 생성된 0,0 좌표
    return _KOREA_LAT[0] <= lat <= _KOREA_LAT[1] and _KOREA_LNG[0] <= lng <= _KOREA_LNG[1]


@router.post("/directions", summary="Directions 5 – 실제 도로 경로 조회")
async def get_route_directions(body: DirectionsRequest):
    """start → waypoints → goal 순서로 실제 도로 경로 좌표 배열 반환.

    waypoints는 최대 5개 (Directions 5 제한). 하루 일정 단위로 호출할 것.

    Returns:
        성공: {"path": [[lng, lat], ...], "summary": {"distance": m, "duration": ms}}
        실패: {"path": [], "summary": ..., "fallback": true}  ← 항상 200, 브라우저 에러 없음

    Naver API 실패 원인: 할당량 초과·도로망 밖 좌표·동일 출발/도착·geocoding 0,0 등
    모두 fallback으로 처리 → 프론트엔드가 직선 점선 경로로 자동 대체한다.
    """
    all_points = [body.start, body.goal] + list(body.waypoints)

    # 유효하지 않은 좌표 감지 (0,0 또는 한국 범위 외 geocoding 실패 좌표)
    invalid = [p for p in all_points if not _is_valid_korea_coord(p.lat, p.lng)]
    if invalid:
        logger.warning(
            "Directions fallback – 유효하지 않은 좌표 %d개: %s",
            len(invalid),
            [(round(p.lat, 4), round(p.lng, 4)) for p in invalid],
        )
        return _DIRECTIONS_FALLBACK

    # 출발지 == 도착지 (50m 이내) – Naver API 거부 케이스
    if _haversine_m(body.start.lat, body.start.lng, body.goal.lat, body.goal.lng) < 50:
        logger.info("Directions fallback – 출발지/도착지 동일 위치 (50m 이내)")
        return _DIRECTIONS_FALLBACK

    wp = [(w.lng, w.lat) for w in body.waypoints] if body.waypoints else None

    result = await get_directions(
        start_lng=body.start.lng,
        start_lat=body.start.lat,
        goal_lng=body.goal.lng,
        goal_lat=body.goal.lat,
        waypoints=wp,
    )

    if result is None:
        # 할당량 초과, 경로 없음(도서 등), 기타 Naver API 오류
        logger.warning("Directions fallback – Naver API 응답 없음 (할당량 초과 또는 경로 불가)")
        return _DIRECTIONS_FALLBACK

    return result
