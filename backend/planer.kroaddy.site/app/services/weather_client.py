"""
공공데이터포털 기상청 단기예보 API 연동.
환경변수: DATA_GO_KR_SERVICE_KEY
"""
import os
from typing import Any

import httpx

WEATHER_BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"


def get_service_key() -> str:
    return os.getenv("DATA_GO_KR_SERVICE_KEY", "").strip()


def fetch_weather(
    base_date: str,
    base_time: str = "0500",
    nx: int = 60,
    ny: int = 127,
    num_of_rows: int = 1000,
) -> dict[str, Any]:
    """
    기상청 단기예보 조회.
    base_date: yyyyMMdd
    base_time: 0200, 0500, 0800, 1100, 1400, 1700, 2000, 2300
    nx, ny: 격자 (서울 60, 127)
    """
    key = get_service_key()
    if not key:
        return {
            "response": {
                "header": {"resultCode": "99", "resultMsg": "API 키가 설정되지 않았습니다."},
                "body": {},
            }
        }

    with httpx.Client(timeout=30.0) as client:
        r = client.get(
            WEATHER_BASE,
            params={
                "serviceKey": key,
                "pageNo": 1,
                "numOfRows": num_of_rows,
                "dataType": "JSON",
                "base_date": base_date,
                "base_time": base_time,
                "nx": nx,
                "ny": ny,
            },
        )
        r.raise_for_status()
        return r.json()


def summarize_by_date(items: list[dict]) -> dict[str, dict]:
    """fcstDate 기준으로 TMP, SKY 등 요약 (당일 대표값)."""
    by_date: dict[str, dict] = {}
    for it in items:
        date = it.get("fcstDate") or it.get("fcstDate", "")
        cat = it.get("category") or ""
        val = it.get("fcstValue") or ""
        if date not in by_date:
            by_date[date] = {}
        if cat == "TMP":
            by_date[date]["temp"] = val
        elif cat == "SKY":
            by_date[date]["sky"] = val  # 1맑음 3구름많음 4흐림
        elif cat == "PTY":
            by_date[date]["pty"] = val  # 0없음 1비 2비/눈 3눈 4소나기
        elif cat == "POP":
            by_date[date]["pop"] = val  # 강수확률
    return by_date
