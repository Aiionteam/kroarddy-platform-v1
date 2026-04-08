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
_STATIC_MAP_URL = "https://maps.apigw.ntruss.com/map-static/v2/raster-cors"
_DIRECTIONS_URL = "https://maps.apigw.ntruss.com/map-direction/v1/driving"
# 네이버 지역 검색 API (장소명 → 좌표, developers.naver.com)
_SEARCH_LOCAL_URL = "https://openapi.naver.com/v1/search/local.json"

_NAVER_HEADERS = {
    "x-ncp-apigw-api-key-id": settings.naver_map_client_id,
    "x-ncp-apigw-api-key": settings.naver_map_client_secret,
    "Accept": "application/json",
}

# ── 공유 httpx 클라이언트 (Connection Pool 재사용, TCP handshake 1회) ──────────
# 매 geocode 호출마다 새 클라이언트를 생성하면 12개 요청 × TCP handshake 오버헤드 발생.
# 모듈 레벨 싱글턴으로 연결 풀을 유지해 geocoding 배치 처리 속도를 크게 단축한다.
_naver_client = httpx.AsyncClient(
    timeout=httpx.Timeout(connect=3.0, read=5.0, write=3.0, pool=1.0),
    limits=httpx.Limits(max_connections=30, max_keepalive_connections=10, keepalive_expiry=20),
)


async def close_naver_client() -> None:
    """앱 종료 시 공유 클라이언트를 정상 종료한다 (main.py lifespan에서 호출)."""
    if not _naver_client.is_closed:
        await _naver_client.aclose()


async def geocode(query: str) -> dict | None:
    """장소명/주소를 좌표(경도 x, 위도 y)로 변환.

    공유 httpx 클라이언트를 사용해 Connection Pool을 재활용한다.
    병렬 호출 시 TCP 핸드셰이크를 1회만 수행하므로 배치 geocoding이 빠르다.

    Returns:
        {"x": "127.xxx", "y": "37.xxx", "address": "...", "road_address": "..."} or None
    """
    if not settings.naver_map_client_id or not settings.naver_map_client_secret:
        logger.warning("네이버 Maps API 키가 설정되지 않았습니다.")
        return None

    try:
        resp = await _naver_client.get(
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

    # raster-cors 엔드포인트: 인증을 쿼리 파라미터로 전달
    # (헤더 방식의 raster는 NCP 서버환경 등록 필요 → 403)
    # markers pos 구분자는 공백(스페이스) 사용 – 웹(NaverMapModal.tsx)과 동일하게.
    # %20을 직접 쓰면 httpx가 %2520으로 이중 인코딩하므로 리터럴 스페이스로 작성.
    params = {
        "center": f"{lng},{lat}",
        "level": zoom,
        "w": min(width, 1024),
        "h": min(height, 1024),
        "maptype": "basic",
        "format": "jpg",
        "scale": 1,
        "markers": f"type:d|size:mid|pos:{lng} {lat}",
        "X-NCP-APIGW-API-KEY-ID": settings.naver_map_client_id,
    }

    try:
        resp = await _naver_client.get(_STATIC_MAP_URL, params=params)
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

    try:
        resp = await _naver_client.get(
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

    try:
        resp = await _naver_client.get(_DIRECTIONS_URL, params=params, headers=_NAVER_HEADERS)
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
