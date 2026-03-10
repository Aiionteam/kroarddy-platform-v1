"""날씨 API 라우터 – 기상청 단기예보 프록시."""
from fastapi import APIRouter, Query

from app.services.weather_client import fetch_weather, summarize_by_date

router = APIRouter(prefix="/api/v1/weather", tags=["weather"])


@router.get("", summary="기상청 단기예보 (날짜/격자)")
async def get_weather(
    date: str = Query(..., description="예보 날짜 (YYYY-MM-DD)"),
    nx: int = Query(60, description="격자 X"),
    ny: int = Query(127, description="격자 Y"),
):
    data = fetch_weather(date=date, nx=nx, ny=ny)
    by_date = summarize_by_date(data)
    return {"date": date, "nx": nx, "ny": ny, "byDate": by_date}
