"""카카오 로컬 API 클라이언트 – 장소 키워드 검색 (POI → 좌표).

Naver Maps Geocoding API는 주소 DB 기반이라 장소명 검색 적중률이 낮음.
카카오 키워드 검색은 POI(Point of Interest) DB를 사용해 장소명 → 좌표 변환이 정확함.

무료 할당량: 300,000 QPS/일 (developers.kakao.com 기준)
"""
import logging
import re

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


# LLM이 생성한 모호한 장소명에서 핵심 키워드를 추출하는 패턴
# 예: "행주산성 역사공원 내 식당" → "행주산성 역사공원"
_VAGUE_SUFFIX_RE = re.compile(
    r"\s*(내\s*(식당|카페|레스토랑|맛집|음식점|카페|편의점|마트|가게|숍|샵)?"
    r"|근처\s*(식당|카페|맛집)?"
    r"|에서\s*(점심|저녁|아침|브런치|식사)?"
    r"|앞\s*(식당|카페)?"
    r"|주변\s*(맛집|식당|카페)?)\s*$",
    re.IGNORECASE,
)

_CATEGORY_KEYWORDS = ("맛집", "식당", "카페", "레스토랑", "음식점", "숙소", "호텔", "모텔", "펜션")


def _refine_place_query(name: str) -> list[str]:
    """모호한 장소명에서 검색 가능한 후보 키워드 목록을 생성한다.

    예:
    - "행주산성 역사공원 내 식당" → ["행주산성 역사공원 식당", "행주산성 역사공원"]
    - "경복궁 근처 카페" → ["경복궁 카페", "경복궁"]
    - "설악산 맛집" → ["설악산 맛집"]  (변경 없음, 원본 그대로)
    """
    name = name.strip()
    candidates: list[str] = []

    m = _VAGUE_SUFFIX_RE.search(name)
    if m:
        base = name[: m.start()].strip()
        # 카테고리 키워드 추출 (있으면 base + 카테고리로 재검색)
        suffix_text = m.group(0).strip()
        category = next((k for k in _CATEGORY_KEYWORDS if k in suffix_text), None)
        if category:
            candidates.append(f"{base} {category}")
        candidates.append(base)

    return candidates


async def kakao_keyword_search_with_fallback(
    query: str,
    *,
    region: str = "",
) -> dict | None:
    """카카오 키워드 검색 – 실패 시 모호한 표현 제거 후 재시도.

    1차: 원본 query 검색
    2차: 모호한 접미사 제거 후 핵심 키워드로 재검색
    """
    result = await kakao_keyword_search(query, region=region)
    if result:
        return result

    refined_candidates = _refine_place_query(query)
    for refined in refined_candidates:
        if refined == query:
            continue
        logger.info("카카오 재검색 (정제된 키워드): '%s' → '%s'", query, refined)
        result = await kakao_keyword_search(refined, region=region)
        if result:
            logger.info("카카오 재검색 성공: '%s'", refined)
            return result

    return None
