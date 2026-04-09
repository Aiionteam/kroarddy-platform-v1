"""KOBIS (한국영화진흥위원회) 영화 상영 정보 클라이언트.

영화 관련 일정 수정 요청 시 실시간 박스오피스 데이터를 LLM 프롬프트에 주입한다.
Gemini grounding만으로는 부족할 수 있어, 영화 일정 보강용으로 KOBIS 실시간 정보를
직접 공급한다.
"""
import logging
from datetime import datetime, timedelta

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

KOBIS_BOXOFFICE_URL = (
    "http://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice"
    "/searchDailyBoxOfficeList.json"
)

# 영화 관련 키워드 (한국어 + 영어)
_MOVIE_KEYWORDS = (
    "영화", "상영", "무비", "시네마", "극장", "cgv", "롯데시네마", "메가박스",
    "movie", "film", "cinema", "theater", "theatre", "screening",
)


def is_movie_query(text: str) -> bool:
    """텍스트에 영화 관련 키워드가 포함되어 있는지 확인."""
    lower = text.lower()
    return any(k in lower for k in _MOVIE_KEYWORDS)


async def fetch_boxoffice(target_dt: str | None = None) -> list[dict]:
    """KOBIS 일별 박스오피스 TOP 10 조회.

    Args:
        target_dt: YYYYMMDD 형식. None이면 어제 날짜 사용
                   (KOBIS는 당일 데이터 미집계 → 전날 기준).

    Returns:
        박스오피스 영화 dict 리스트. 실패 시 빈 리스트.
    """
    if not settings.kobis_api_key:
        logger.debug("KOBIS API 키 미설정 – 박스오피스 조회 생략")
        return []

    if target_dt is None:
        yesterday = datetime.now() - timedelta(days=1)
        target_dt = yesterday.strftime("%Y%m%d")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                KOBIS_BOXOFFICE_URL,
                params={"key": settings.kobis_api_key, "targetDt": target_dt},
            )
            resp.raise_for_status()
            data = resp.json()
            movies: list[dict] = (
                data.get("boxOfficeResult", {}).get("dailyBoxOfficeList", [])
            )
            logger.info(
                "KOBIS 박스오피스 조회 성공: %d편 (%s 기준)", len(movies), target_dt
            )
            return movies
    except Exception as exc:
        logger.warning("KOBIS 조회 실패 (무시하고 진행): %s", exc)
        return []


def format_boxoffice_context(movies: list[dict]) -> str:
    """박스오피스 데이터를 LLM 프롬프트 삽입용 텍스트 블록으로 변환."""
    if not movies:
        return ""

    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    lines = [f"【현재 상영 중인 영화 – KOBIS 박스오피스 ({yesterday} 기준)】"]

    for m in movies[:10]:
        rank = m.get("rank", "?")
        title = m.get("movieNm", "")
        open_dt = m.get("openDt", "")
        aud_acc = m.get("audiAcc", "")

        line = f"  {rank}위. {title}"
        if open_dt:
            line += f"  (개봉일: {open_dt})"
        if aud_acc and aud_acc.isdigit():
            line += f"  누적관객: {int(aud_acc):,}명"
        lines.append(line)

    lines.append(
        "- 위 목록에 없는 영화는 현재 상영 중이 아닐 가능성이 높습니다.\n"
        "- 일정 수정 시 실제 상영 중인 영화만 추천하세요."
    )
    return "\n".join(lines)
