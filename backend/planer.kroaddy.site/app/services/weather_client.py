"""OpenWeatherMap 5-day / 3-hour forecast API 연동.

무료 플랜: 5일(약 40개 3시간 슬롯) 예보만 지원.
5일 초과 여행 날짜는 예보 불가 메시지로 처리한다.
환경변수: OPENWEATHER_API_KEY
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

# 한국 표준시 (UTC+9)
KST = timezone(timedelta(hours=9))

# 오전(9시) / 점심(12시) / 오후(15시) / 저녁(18시) – KST 시각 기준
TIME_LABELS: dict[str, int] = {
    "오전": 9,
    "점심": 12,
    "오후": 15,
    "저녁": 18,
    "밤":   21,
}

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_OWM_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"
_OWM_GEO_URL = "https://api.openweathermap.org/geo/1.0/direct"

# 코드 → 한글 날씨 요약
_WEATHER_DESC_KO: dict[str, str] = {
    "Clear": "맑음",
    "Clouds": "구름",
    "Rain": "비",
    "Drizzle": "이슬비",
    "Thunderstorm": "천둥번개",
    "Snow": "눈",
    "Mist": "안개",
    "Fog": "짙은안개",
    "Haze": "연무",
    "Dust": "황사",
    "Sand": "황사",
    "Tornado": "토네이도",
}


def _ko_desc(main: str, description: str) -> str:
    return _WEATHER_DESC_KO.get(main, description)


async def fetch_coords_for_location(location_name: str) -> tuple[float, float] | None:
    """지역명 → (lat, lon). Geocoding API 활용.

    OWM Geocoding은 q=<name>,<country_code> 형식에서 정확도가 높아짐.
    한국 지명이면 KR 코드를 붙여 먼저 시도하고, 실패 시 코드 없이 재시도.
    """
    key = settings.openweather_api_key
    if not key:
        return None

    # 국가 코드가 없을 때만 KR 붙여 시도 (이미 콤마 포함이면 그대로)
    queries = (
        [location_name]
        if "," in location_name
        else [f"{location_name},KR", location_name]
    )

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            for q in queries:
                r = await client.get(
                    _OWM_GEO_URL,
                    params={"q": q, "limit": 1, "appid": key},
                )
                r.raise_for_status()
                data = r.json()
                if data:
                    logger.debug("OWM Geocoding 성공: %s → (%.4f, %.4f)", q, data[0]["lat"], data[0]["lon"])
                    return float(data[0]["lat"]), float(data[0]["lon"])
        logger.info("OWM Geocoding: 모든 쿼리에서 결과 없음 (%s)", queries)
    except Exception as e:
        logger.warning("OWM Geocoding 실패 (%s): %s", location_name, e)
    return None


async def fetch_weather_forecast(
    lat: float,
    lon: float,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict[str, Any]:
    """OWM 5-day/3-hour 예보를 날짜별로 요약해 반환.

    Args:
        lat, lon: WGS84 좌표
        start_date: 여행 시작일 YYYY-MM-DD (없으면 전체)
        end_date: 여행 종료일 YYYY-MM-DD

    Returns:
        {
          "available": True/False,   # False = 5일 초과로 예보 불가
          "dates": {
            "2025-06-01": {
              "temp_min": 18, "temp_max": 28,
              "condition": "맑음",            # 대표 날씨
              "pop": 10,                       # 최대 강수확률(%)
              "advice": "야외 활동하기 좋은 날씨입니다."
            }, ...
          }
        }
    """
    key = settings.openweather_api_key
    if not key:
        return {"available": False, "reason": "OPENWEATHER_API_KEY 미설정", "dates": {}}

    # 5일 예보 한계 체크
    today = datetime.now(timezone.utc).date()
    if start_date:
        try:
            travel_start = datetime.strptime(start_date, "%Y-%m-%d").date()
            days_until = (travel_start - today).days
            if days_until > 5:
                return {
                    "available": False,
                    "reason": f"여행 출발일이 {days_until}일 후로 5일 예보 범위를 초과합니다.",
                    "dates": {},
                }
        except ValueError:
            pass

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                _OWM_FORECAST_URL,
                params={"lat": lat, "lon": lon, "appid": key, "units": "metric", "lang": "kr", "cnt": 40},
            )
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.warning("OWM 예보 API 실패: %s", e)
        return {"available": False, "reason": str(e), "dates": {}}

    # 날짜별 집계 (KST 기준)
    # OWM dt_txt 는 UTC 이므로 +9h 하여 KST 날짜/시각으로 분류
    by_date: dict[str, dict] = {}
    for slot in data.get("list", []):
        dt_txt = slot.get("dt_txt", "")  # "2025-06-01 12:00:00" UTC
        if not dt_txt:
            continue

        # UTC → KST 변환
        utc_dt = datetime.strptime(dt_txt, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        kst_dt = utc_dt.astimezone(KST)
        date_str = kst_dt.strftime("%Y-%m-%d")   # KST 날짜
        kst_hour = kst_dt.hour                    # KST 시각 (0~23)

        # 여행 기간 외 슬롯 제외
        if start_date and date_str < start_date:
            continue
        if end_date and date_str > end_date:
            continue

        main_data = slot.get("main", {})
        weather_list = slot.get("weather", [{}])
        w = weather_list[0]
        condition_main = w.get("main", "")
        condition_desc = w.get("description", "")
        temp = float(main_data.get("temp", 0))
        pop = int(round(float(slot.get("pop", 0)) * 100))
        ko_cond = _ko_desc(condition_main, condition_desc)

        if date_str not in by_date:
            by_date[date_str] = {
                "temps": [],
                "conditions": [],
                "pop_max": 0,
                # 각 KST 시각 슬롯 저장 (오전9·점심12·오후15·저녁18·밤21)
                "time_slots": {},
            }
        by_date[date_str]["temps"].append(temp)
        by_date[date_str]["conditions"].append(ko_cond)
        by_date[date_str]["pop_max"] = max(by_date[date_str]["pop_max"], pop)

        # 오전(9)/점심(12)/오후(15)/저녁(18)/밤(21) 중 가장 가까운 슬롯에 매핑
        _SLOT_HOURS = (9, 12, 15, 18, 21)
        closest_hour = min(_SLOT_HOURS, key=lambda h: abs(kst_hour - h))
        slot_key = f"{closest_hour:02d}"
        # 같은 슬롯에 여러 개 들어오면 더 가까운 것만 보관
        existing = by_date[date_str]["time_slots"].get(slot_key)
        if existing is None or abs(kst_hour - closest_hour) < existing["_dist"]:
            by_date[date_str]["time_slots"][slot_key] = {
                "temp": round(temp, 1),
                "condition": ko_cond,
                "pop": pop,
                "_dist": abs(kst_hour - closest_hour),
            }

    result_dates: dict[str, dict] = {}
    for date_str, agg in by_date.items():
        temps = agg["temps"]
        conditions = agg["conditions"]
        pop = agg["pop_max"]

        dominant = max(set(conditions), key=conditions.count)
        advice = _build_weather_advice(dominant, pop, min(temps), max(temps))

        # time_slots에서 _dist 제거 후 반환
        clean_slots: dict[str, dict] = {}
        for slot_key, slot_val in agg["time_slots"].items():
            clean_slots[slot_key] = {k: v for k, v in slot_val.items() if k != "_dist"}

        result_dates[date_str] = {
            "temp_min": round(min(temps), 1),
            "temp_max": round(max(temps), 1),
            "condition": dominant,
            "pop": pop,
            "advice": advice,
            "time_slots": clean_slots,   # {"09": {...}, "12": {...}, "15": {...}, "18": {...}}
        }

    return {"available": bool(result_dates), "dates": result_dates}


def _build_weather_advice(condition: str, pop: int, t_min: float, t_max: float) -> str:
    """날씨 조건 → 루트 추천용 한 줄 조언."""
    if condition in ("비", "이슬비", "천둥번개") or pop >= 60:
        return "우천 예보 – 실내 위주 코스(박물관·카페·쇼핑몰)를 우선 배치하세요."
    if condition == "눈":
        return "눈 예보 – 설경 명소와 실내 체험을 혼합 배치하세요."
    if condition in ("황사", "연무", "안개", "짙은안개"):
        return "미세먼지·안개 주의 – 실내 코스 위주로, 야외 활동은 짧게 구성하세요."
    if t_max >= 33:
        return f"폭염({t_max}°C) – 오전·저녁 야외 활동, 점심·오후는 실내(카페·박물관)로 배치하세요."
    if t_min <= 0:
        return f"한파({t_min}°C) – 실내 코스 위주, 야외 명소는 이동 시간을 최소화하세요."
    if pop >= 30:
        return f"강수 가능성 {pop}% – 우산 준비, 실외 장시간 활동은 유연하게 조정하세요."
    return "쾌적한 날씨 – 야외·실내 코스를 자유롭게 배치할 수 있습니다."


def build_weather_block_for_prompt(
    forecast: dict[str, Any],
    start_date: str | None,
    end_date: str | None,
) -> str:
    """날씨 예보 dict → Gemini 프롬프트 삽입 텍스트."""
    if not forecast.get("available"):
        reason = forecast.get("reason", "")
        if "초과" in reason:
            return (
                "【날씨 예보】5일 예보 범위를 초과하는 여행 날짜입니다. "
                "날씨에 관계없이 다양한 실내·야외 조합으로 루트를 구성하세요.\n\n"
            )
        return ""

    dates = forecast.get("dates", {})
    if not dates:
        return ""

    lines = ["【날씨 예보 (OpenWeatherMap 기준)】"]
    for d, info in sorted(dates.items()):
        line = (
            f"  {d}: {info['condition']} {info['temp_min']}°C~{info['temp_max']}°C "
            f"강수{info['pop']}% – {info['advice']}"
        )
        lines.append(line)
    lines.append("")
    return "\n".join(lines) + "\n"


async def fetch_weather_for_planner(
    location_name: str,
    location_coords: tuple[float, float] | None,
    start_date: str | None,
    end_date: str | None,
) -> dict[str, Any]:
    """플래너 파이프라인용 편의 함수. 좌표 없으면 지역명으로 Geocoding 후 예보 조회."""
    if not settings.openweather_api_key:
        return {"available": False, "reason": "OPENWEATHER_API_KEY 미설정", "dates": {}}

    coords = location_coords
    if coords is None:
        coords = await fetch_coords_for_location(location_name)

    if coords is None:
        logger.warning("OWM: %s 좌표 조회 실패 – 날씨 생략", location_name)
        return {"available": False, "reason": "좌표 조회 실패", "dates": {}}

    lat, lon = coords
    return await fetch_weather_forecast(lat, lon, start_date, end_date)
