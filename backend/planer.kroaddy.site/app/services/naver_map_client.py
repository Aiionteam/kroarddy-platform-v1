"""네이버 Maps API 클라이언트 – Geocoding / Static Map / Directions 5."""
import logging
import re

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# 지역검색 link URL 내 플레이스 ID (pcmap.place.naver.com/place/123/… 등)
_NAVER_PLACE_ID_RE = re.compile(r"place/(\d{5,})")


def extract_naver_place_id_from_link(link: str | None) -> str | None:
    """네이버 지역검색 API item.link 에서 숫자 place id 추출."""
    if not link:
        return None
    m = _NAVER_PLACE_ID_RE.search(link)
    return m.group(1) if m else None

_GEOCODE_URL    = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode"
_STATIC_MAP_URL = "https://maps.apigw.ntruss.com/map-static/v2/raster"
_DIRECTIONS_URL = "https://maps.apigw.ntruss.com/map-direction/v1/driving"
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
    """네이버 Static Map 이미지 바이너리 반환.

    모바일(Flutter 등) 호환: 이 함수는 **서버에서만** NCP 키로 Naver를 호출한다.
    앱은 Naver에 직접 붙지 말고, 백엔드 ``GET /api/v1/maps/static-map`` 를 호출하고
    응답 바디를 **바이너리(JPEG)** 로 받으면 된다. (웹 전용이 아님)
    """
    if not settings.naver_map_client_id or not settings.naver_map_client_secret:
        logger.warning("네이버 Maps API 키가 설정되지 않았습니다.")
        return None

    # markers: 공식 형식은 pos:경도,위도(쉼표). 공백+%20은 스펙과 맞지 않고,
    # httpx가 쿼리 인코딩 시 % → %25 로 이중 인코딩되어 Naver 4xx를 유발할 수 있음.
    params = {
        "center": f"{lng},{lat}",
        "level": zoom,
        "w": min(width, 1024),
        "h": min(height, 1024),
        "maptype": "basic",
        "format": "jpg",
        "scale": 1,
        "markers": f"type:d|size:mid|color:Red|pos:{lng},{lat}",
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
        except httpx.HTTPStatusError as e:
            logger.error(
                "Static Map HTTP 오류 %d (lat=%s, lng=%s): %s",
                e.response.status_code,
                lat,
                lng,
                e.response.text[:300],
            )
            return None
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
            name = re.sub(r"<[^>]+>", "", item.get("title", query))
            link = item.get("link") or ""

            return {
                "x": str(lng),
                "y": str(lat),
                "name": name,
                "address": item.get("roadAddress") or item.get("address", ""),
                "link": link,
                "place_id": extract_naver_place_id_from_link(link),
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
) -> dict | None:
    """Directions 5 API로 실제 도로 경로 반환.

    Args:
        waypoints: [(lng, lat), ...] 최대 5개 (Directions 5 제한)

    Returns:
        {"path": [[lng, lat], ...], "summary": {"distance": m, "duration": ms}} or None
    """
    if not settings.naver_map_client_id or not settings.naver_map_client_secret:
        logger.warning("네이버 Maps API 키가 설정되지 않았습니다.")
        return None

    params: dict[str, str] = {
        "start": f"{start_lng},{start_lat}",
        "goal":  f"{goal_lng},{goal_lat}",
        "option": "traoptimal",
    }
    if waypoints:
        # Directions 5 최대 5개 경유지 제한
        params["waypoints"] = "|".join(f"{lng},{lat}" for lng, lat in waypoints[:5])

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
                    r = route_list[0]
                    summary = r.get("summary", {})
                    return {
                        "path": r.get("path", []),
                        "summary": {
                            "distance": summary.get("distance", 0),  # 미터
                            "duration": summary.get("duration", 0),  # 밀리초
                        },
                    }

            return None
        except Exception as e:
            logger.error("Directions 오류: %s", e)
            return None
