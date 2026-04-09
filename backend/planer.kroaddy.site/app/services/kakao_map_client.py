"""카카오 로컬 API 클라이언트 – 장소 키워드 검색 (POI → 좌표).

Naver Maps Geocoding API는 주소 DB 기반이라 장소명 검색 적중률이 낮음.
카카오 키워드 검색은 POI(Point of Interest) DB를 사용해 장소명 → 좌표 변환이 정확함.

무료 할당량: 300,000 QPS/일 (developers.kakao.com 기준)
"""
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"

_kakao_client = httpx.AsyncClient(
    timeout=httpx.Timeout(connect=3.0, read=5.0, write=3.0, pool=1.0),
    limits=httpx.Limits(max_connections=20, max_keepalive_connections=5, keepalive_expiry=20),
)


async def close_kakao_client() -> None:
    if not _kakao_client.is_closed:
        await _kakao_client.aclose()


async def kakao_keyword_search(
    query: str,
    *,
    region: str = "",
    size: int = 1,
) -> dict | None:
    """카카오 장소 키워드 검색 → 첫 번째 결과 반환.

    Args:
        query: 검색어 (장소명, 예: '울산암각화박물관')
        region: 지역 힌트 – query 앞에 붙여 검색 정확도를 높임 (예: '울산')
        size: 결과 수 (기본 1)

    Returns:
        {
            "x": "lng_str", "y": "lat_str",
            "name": "장소명", "address": "지번주소",
            "road_address": "도로명주소", "category": "카테고리",
            "place_url": "https://place.map.kakao.com/..."
        }
        or None
    """
    if not settings.kakao_rest_api_key:
        logger.warning("KAKAO_REST_API_KEY 미설정 – 카카오 장소 검색 건너뜀")
        return None

    search_q = f"{region} {query}".strip() if region else query
    params = {"query": search_q, "size": str(size)}
    headers = {"Authorization": f"KakaoAK {settings.kakao_rest_api_key}"}

    try:
        resp = await _kakao_client.get(_KAKAO_KEYWORD_URL, params=params, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.error("카카오 키워드 검색 오류 (query=%s): %s", search_q, e)
        return None

    docs = data.get("documents") or []
    if not docs:
        logger.info("카카오 검색 결과 없음: %s", search_q)
        return None

    doc = docs[0]
    x = doc.get("x") or ""  # 경도(lng)
    y = doc.get("y") or ""  # 위도(lat)

    if not x or not y:
        return None

    return {
        "x": x,
        "y": y,
        "name": doc.get("place_name", query),
        "address": doc.get("address_name", ""),
        "road_address": doc.get("road_address_name", ""),
        "category": doc.get("category_name", ""),
        "place_url": doc.get("place_url", ""),
    }
