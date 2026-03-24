"""네이버 Maps API 클라이언트 – Geocoding / Static Map / Directions 15."""
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_GEOCODE_URL    = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode"
_STATIC_MAP_URL = "https://maps.apigw.ntruss.com/map-static/v2/raster"
_DIRECTIONS_URL = "https://maps.apigw.ntruss.com/map-direction-15/v1/driving"
# 네이버 지역 검색 API (장소명 → 좌표, developers.naver.com)
_SEARCH_LOCAL_URL = "https://openapi.naver.com/v1/search/local.json"

_NAVER_HEADERS = {
    "x-ncp-apigw-api-key-id": settings.naver_map_client_id,
    "x-ncp-apigw-api-key": settings.naver_map_client_secret,
    "Accept": "application/json",
}


async def geocode(query: str) -> dict | None:
    """장소명/주소를 좌표(경도 x, 위도 y)로 변환.

    Returns:
        {"x": "127.xxx", "y": "37.xxx", "address": "...", "road_address": "..."} or None
    """
    if not settings.naver_map_client_id or not settings.naver_map_client_secret:
        logger.warning("네이버 Maps API 키가 설정되지 않았습니다.")
        return None

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                _GEOCODE_URL,
                params={"query": query, "count": 1},
                headers=_NAVER_HEADERS,
            )
            resp.raise_for_status()
            data = resp.json()

            addresses = data.get("addresses", [])
            if not addresses:
                logger.info("Geocoding 결과 없음: %s", query)
                return None

            addr = addresses[0]
            return {
                "x": addr.get("x", ""),
                "y": addr.get("y", ""),
                "address": addr.get("jibunAddress", ""),
                "road_address": addr.get("roadAddress", ""),
            }
        except Exception as e:
            logger.error("Geocoding 오류 (query=%s): %s", query, e)
            return None


async def fetch_static_map(
    lat: float,
    lng: float,
    width: int = 400,
    height: int = 300,
    zoom: int = 15,
) -> bytes | None:
    """네이버 Static Map 이미지 바이너리 반환."""
    if not settings.naver_map_client_id or not settings.naver_map_client_secret:
        logger.warning("네이버 Maps API 키가 설정되지 않았습니다.")
        return None

    params = {
        "center": f"{lng},{lat}",
        "level": zoom,
        "w": min(width, 1024),
        "h": min(height, 1024),
        "maptype": "basic",
        "format": "jpg",
        "scale": 1,
        "markers": f"type:d|size:mid|color:Red|pos:{lng}%20{lat}",
    }

    headers = {
        "x-ncp-apigw-api-key-id": settings.naver_map_client_id,
        "x-ncp-apigw-api-key": settings.naver_map_client_secret,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(_STATIC_MAP_URL, params=params, headers=headers)
            resp.raise_for_status()
            return resp.content
        except Exception as e:
            logger.error("Static Map 오류 (lat=%s, lng=%s): %s", lat, lng, e)
            return None


async def keyword_search(query: str) -> dict | None:
    """네이버 지역 검색 API로 장소명 → 좌표 변환 (developers.naver.com).

    주소 기반 Geocoding API와 달리 장소명·상호명으로 검색 가능.

    Returns:
        {"x": lng, "y": lat, "name": "...", "address": "..."} or None
    """
    if not settings.naver_search_client_id or not settings.naver_search_client_secret:
        logger.warning("네이버 Search API 키가 설정되지 않았습니다.")
        return None

    headers = {
        "X-Naver-Client-Id": settings.naver_search_client_id,
        "X-Naver-Client-Secret": settings.naver_search_client_secret,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                _SEARCH_LOCAL_URL,
                params={"query": query, "display": 1},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            items = data.get("items", [])
            if not items:
                logger.info("지역 검색 결과 없음: %s", query)
                return None

            item = items[0]
            # mapx/mapy 는 WGS84 × 1e7 (도 단위 * 10,000,000)
            lng = int(item["mapx"]) / 1e7
            lat = int(item["mapy"]) / 1e7

            # HTML 태그 제거 (e.g. <b>군산</b>근대역사박물관)
            import re
            name = re.sub(r"<[^>]+>", "", item.get("title", query))

            return {
                "x": str(lng),
                "y": str(lat),
                "name": name,
                "address": item.get("roadAddress") or item.get("address", ""),
            }
        except Exception as e:
            logger.error("지역 검색 오류 (query=%s): %s", query, e)
            return None


async def get_directions(
    start_lng: float,
    start_lat: float,
    goal_lng: float,
    goal_lat: float,
    waypoints: list[tuple[float, float]] | None = None,
) -> list[list[float]] | None:
    """Directions 15 API로 실제 도로 경로 좌표 배열 반환.

    Args:
        waypoints: [(lng, lat), ...] 최대 15개

    Returns:
        [[lng, lat], [lng, lat], ...] 또는 None
    """
    if not settings.naver_map_client_id or not settings.naver_map_client_secret:
        logger.warning("네이버 Maps API 키가 설정되지 않았습니다.")
        return None

    params: dict = {
        "start": f"{start_lng},{start_lat}",
        "goal":  f"{goal_lng},{goal_lat}",
        "option": "traoptimal",
    }
    if waypoints:
        params["waypoints"] = "|".join(f"{lng},{lat}" for lng, lat in waypoints)

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(_DIRECTIONS_URL, params=params, headers=_NAVER_HEADERS)
            resp.raise_for_status()
            data = resp.json()

            if data.get("code") != 0:
                logger.warning("Directions 결과 없음: code=%s, message=%s", data.get("code"), data.get("message"))
                return None

            routes = data.get("route", {})
            for key in ("traoptimal", "trafast", "tracomfort", "traavoidtoll"):
                route_list = routes.get(key)
                if route_list:
                    return route_list[0].get("path", [])

            return None
        except Exception as e:
            logger.error("Directions 오류: %s", e)
            return None
