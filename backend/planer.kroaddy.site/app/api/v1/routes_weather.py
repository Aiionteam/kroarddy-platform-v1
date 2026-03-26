"""날씨 API 라우터 – OpenWeatherMap 5-day 예보 프록시."""
from fastapi import APIRouter, Query

from app.services.weather_client import fetch_weather_forecast, fetch_coords_for_location

router = APIRouter(prefix="/api/v1/weather", tags=["weather"])


@router.get("", summary="OpenWeatherMap 5-day 예보 (지역명 또는 좌표)")
async def get_weather(
    location: str = Query(None, description="지역명 (예: 서울). lat/lon 있으면 생략 가능"),
    start_date: str = Query(None, description="여행 시작일 YYYY-MM-DD"),
    end_date: str = Query(None, description="여행 종료일 YYYY-MM-DD"),
    lat: float = Query(None, description="위도 – 제공 시 geocoding 생략"),
    lon: float = Query(None, description="경도 – 제공 시 geocoding 생략"),
):
    if lat is None or lon is None:
        if not location:
            return {"available": False, "reason": "location 또는 lat/lon 중 하나는 필수입니다.", "dates": {}}
        coords = await fetch_coords_for_location(location)
        if coords is None:
            return {"available": False, "reason": f"'{location}' 좌표 조회 실패", "dates": {}}
        lat, lon = coords
    forecast = await fetch_weather_forecast(lat, lon, start_date, end_date)
    return forecast
