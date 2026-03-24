"""네이버 Maps API 프록시 라우터 – Geocoding / Static Map."""
import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.services.naver_map_client import fetch_static_map, geocode

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/maps", tags=["maps"])


@router.get("/geocode", summary="장소명/주소 → 좌표 변환 (네이버 Geocoding)")
async def geocode_place(query: str = Query(..., description="검색할 장소명 또는 주소")):
    result = await geocode(query)
    if not result:
        raise HTTPException(status_code=404, detail=f"'{query}'에 대한 위치 정보를 찾을 수 없습니다.")
    return result


@router.get("/static-map", summary="네이버 Static Map 이미지 프록시")
async def static_map(
    lat: float = Query(..., description="위도"),
    lng: float = Query(..., description="경도"),
    w: int = Query(400, ge=50, le=800, description="가로 크기(px)"),
    h: int = Query(300, ge=50, le=600, description="세로 크기(px)"),
    zoom: int = Query(15, ge=6, le=20, description="줌 레벨"),
):
    image_bytes = await fetch_static_map(lat=lat, lng=lng, width=w, height=h, zoom=zoom)
    if not image_bytes:
        raise HTTPException(status_code=502, detail="지도 이미지를 불러오지 못했습니다.")
    return Response(content=image_bytes, media_type="image/jpeg")
