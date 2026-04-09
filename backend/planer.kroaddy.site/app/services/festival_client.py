"""행사 서비스 – data.go.kr 전국문화축제표준데이터 직접 조회.

festival.kroaddy.site 별도 서비스 없이 planer 내부에서 직접 호출.
인메모리 캐시(10분 TTL)로 반복 요청 최소화.
"""
import asyncio
import logging
import re
import time
from calendar import monthrange
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.plan_cache import FestivalCache

logger = logging.getLogger(__name__)

FESTIVAL_BASE = "http://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api"

# ─── 인메모리 캐시 (워커 내 공유) ───────────────────────────
_CACHE_RAW: list[dict] | None = None
_CACHE_EXPIRES_AT: float = 0.0
_CACHE_TTL = 600        # 10분 신선
_CACHE_STALE_TTL = 3600 # 1시간 stale fallback
_CACHE_LOCK = asyncio.Lock()
_DB_CACHE_TTL_DAYS = 7


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)

# ─── 지역 슬러그 → 축제 필터 키워드 ─────────────────────────
_LOCATION_KEYWORDS: dict[str, list[str]] = {
    "seoul":          ["서울"],
    "busan":          ["부산"],
    "daegu":          ["대구"],
    "incheon":        ["인천"],
    "gwangju":        ["광주광역시", "광주 광역", "광주시"],
    "daejeon":        ["대전"],
    "ulsan":          ["울산"],
    "sejong":         ["세종"],
    "suwon":          ["수원"],
    "yongin":         ["용인"],
    "goyang":         ["고양"],
    "hwaseong":       ["화성"],
    "seongnam":       ["성남"],
    "bucheon":        ["부천"],
    "namyangju":      ["남양주"],
    "ansan":          ["안산"],
    "pyeongtaek":     ["평택"],
    "anyang":         ["안양"],
    "siheung":        ["시흥"],
    "paju":           ["파주"],
    "gimpo":          ["김포"],
    "uijeongbu":      ["의정부"],
    "gwangju-g":      ["경기 광주", "광주시 경기"],
    "hanam":          ["하남"],
    "gwangmyeong":    ["광명"],
    "gunpo":          ["군포"],
    "osan":           ["오산"],
    "yangju":         ["양주"],
    "icheon":         ["이천"],
    "guri":           ["구리"],
    "anseong":        ["안성"],
    "uiwang":         ["의왕"],
    "pocheon":        ["포천"],
    "yeoju":          ["여주"],
    "dongducheon":    ["동두천"],
    "gwacheon":       ["과천"],
    "gapyeong":       ["가평"],
    "yangpyeong":     ["양평"],
    "chuncheon":      ["춘천"],
    "wonju":          ["원주"],
    "gangneung":      ["강릉"],
    "donghae":        ["동해"],
    "taebaek":        ["태백"],
    "sokcho":         ["속초"],
    "samcheok":       ["삼척"],
    "yangyang":       ["양양"],
    "pyeongchang":    ["평창"],
    "jeongseon":      ["정선"],
    "inje":           ["인제"],
    "goseong-gw":     ["고성"],
    "cheongju":       ["청주"],
    "chungju":        ["충주"],
    "jecheon":        ["제천"],
    "danyang":        ["단양"],
    "cheonan":        ["천안"],
    "gongju":         ["공주"],
    "boryeong":       ["보령"],
    "asan":           ["아산"],
    "seosan":         ["서산"],
    "nonsan":         ["논산"],
    "dangjin":        ["당진"],
    "taean":          ["태안"],
    "buyeo":          ["부여"],
    "jeonju":         ["전주"],
    "gunsan":         ["군산"],
    "iksan":          ["익산"],
    "jeongeup":       ["정읍"],
    "namwon":         ["남원"],
    "gimje":          ["김제"],
    "mokpo":          ["목포"],
    "yeosu":          ["여수"],
    "suncheon":       ["순천"],
    "naju":           ["나주"],
    "gwangyang":      ["광양"],
    "damyang":        ["담양"],
    "boseong":        ["보성"],
    "wando":          ["완도"],
    "pohang":         ["포항"],
    "gyeongju":       ["경주"],
    "gimcheon":       ["김천"],
    "andong":         ["안동"],
    "gumi":           ["구미"],
    "yeongju":        ["영주"],
    "yeongcheon":     ["영천"],
    "sangju":         ["상주"],
    "mungyeong":      ["문경"],
    "gyeongsan":      ["경산"],
    "changwon":       ["창원"],
    "jinju":          ["진주"],
    "tongyeong":      ["통영"],
    "sacheon":        ["사천"],
    "gimhae":         ["김해"],
    "miryang":        ["밀양"],
    "geoje":          ["거제"],
    "yangsan":        ["양산"],
    "namhae":         ["남해"],
    "hapcheon":       ["합천"],
    "jeju":           ["제주"],
    "seogwipo":       ["서귀포"],
    # 관광지 슬러그
    "palgongsan":     ["팔공산", "대구", "경북"],
    "gayasan":        ["가야산", "합천", "성주"],
    "juwangsan":      ["주왕산", "청송"],
    "nakdonggang":    ["낙동강"],
    "jirisan":        ["지리산", "구례", "남원", "함양", "산청"],
    "hallyeohaesang": ["한려해상", "통영", "거제", "남해"],
    "seoraksan":      ["설악산", "속초", "인제", "양양"],
    "odaesan":        ["오대산", "평창", "홍천"],
    "chiaksan":       ["치악산", "원주"],
    "songnisan":      ["속리산", "보은", "괴산"],
    "wolaksan":       ["월악산", "제천", "단양"],
    "bukhansan":      ["북한산", "서울", "고양", "양주"],
    "gwanaksan":      ["관악산", "서울", "안양"],
    "hallasan":       ["한라산", "제주"],
}


# ─── data.go.kr 호출 (동기 – httpx.Client, JS 챌린지 처리) ──

def _fetch_raw(num_of_rows: int = 500) -> list[dict]:
    """data.go.kr 전국문화축제표준데이터 동기 조회. 실패 시 빈 리스트."""
    key = settings.data_go_kr_service_key
    if not key:
        logger.warning("DATA_GO_KR_SERVICE_KEY 미설정 – 행사 정보 없음")
        return []

    params: dict = {
        "serviceKey": key,
        "pageNo": 1,
        "numOfRows": num_of_rows,
        "type": "json",
    }
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Referer": "https://www.data.go.kr/",
    }

    with httpx.Client(timeout=30.0, follow_redirects=True, max_redirects=10,
                      verify=False, headers=headers) as client:
        r = client.get(FESTIVAL_BASE, params=params)
        for _ in range(4):
            body = r.text
            if not body.lstrip().startswith("<"):
                break
            if "서비스 안내" in body or "서비스 점검" in body:
                logger.warning("data.go.kr 서비스 점검 중")
                return []
            redirect = _extract_js_redirect(body, str(r.url))
            if not redirect:
                logger.warning("JS 챌린지 파싱 실패")
                return []
            r = client.get(redirect)
        else:
            return []

        try:
            data = r.json()
        except Exception:
            return []

    return _parse_items(data)


def _extract_js_redirect(html: str, base_url: str) -> str | None:
    from urllib.parse import urljoin
    m = re.search(r"var\s+x\s*=\s*\{o:'([^']*)',t:'([^']*)',h:'([^']*)'\}", html)
    if m:
        return urljoin(base_url, m.group(2) + m.group(3) + m.group(1))
    m2 = re.search(r"var\s+x\s*=\s*\{o:'([^']+)'[^}]*\}", html)
    if m2 and "/openapi/" in m2.group(1):
        from urllib.parse import urljoin
        return urljoin(base_url, m2.group(1))
    m3 = re.search(r"location\.assign\(['\"]([^'\"]+)['\"]", html)
    if m3:
        from urllib.parse import urljoin
        return urljoin(base_url, m3.group(1))
    return None


def _parse_items(data: dict) -> list[dict]:
    resp = data.get("response") or {}
    body = data.get("body") or resp.get("body") or {}
    items_node = body.get("items")
    if items_node is not None:
        if isinstance(items_node, list):
            return items_node
        if isinstance(items_node, dict):
            raw = items_node.get("item")
            if raw is not None:
                return raw if isinstance(raw, list) else [raw]
    raw = body.get("item")
    if raw is not None:
        return raw if isinstance(raw, list) else [raw]
    top = data.get("items")
    if isinstance(top, list):
        return top
    if isinstance(top, dict) and top.get("item") is not None:
        r = top["item"]
        return r if isinstance(r, list) else [r]
    return []


def _date_int(s: str) -> int | None:
    digits = re.sub(r"\D", "", str(s))[:8]
    if len(digits) != 8:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def _normalize(s: str) -> str:
    digits = re.sub(r"\D", "", str(s))[:8]
    return digits if len(digits) == 8 else ""


def _normalize_item(item: dict) -> dict:
    return {
        "fstvlNm":       item.get("fstvlNm")       or item.get("축제명")         or "",
        "opar":          item.get("opar")           or item.get("개최장소")       or "",
        "fstvlStartDate": _normalize(item.get("fstvlStartDate") or item.get("축제시작일자") or ""),
        "fstvlEndDate":   _normalize(item.get("fstvlEndDate")   or item.get("축제종료일자") or ""),
        "fstvlCo":       item.get("fstvlCo")        or item.get("축제내용")       or "",
        "rdnmadr":       item.get("rdnmadr")        or item.get("소재지도로명주소") or "",
        "lnmadr":        item.get("lnmadr")         or item.get("소재지지번주소")  or "",
    }


# ─── 캐시 갱신 ───────────────────────────────────────────────

async def _get_raw_cached() -> list[dict]:
    """인메모리 캐시에서 전체 행사 목록 반환 (만료 시 재조회)."""
    global _CACHE_RAW, _CACHE_EXPIRES_AT
    now = time.time()

    if _CACHE_RAW is not None and now < _CACHE_EXPIRES_AT:
        return _CACHE_RAW

    if _CACHE_LOCK.locked() and _CACHE_RAW is not None:
        return _CACHE_RAW  # 다른 코루틴이 갱신 중 → stale 즉시 반환

    async with _CACHE_LOCK:
        if _CACHE_RAW is not None and time.time() < _CACHE_EXPIRES_AT:
            return _CACHE_RAW
        try:
            loop = asyncio.get_event_loop()
            items = await loop.run_in_executor(None, _fetch_raw)
            if items:
                _CACHE_RAW = items
                _CACHE_EXPIRES_AT = time.time() + _CACHE_TTL
                logger.info("행사 캐시 갱신 완료 (%d건)", len(items))
            else:
                # 조회 실패 → stale 유지
                if _CACHE_RAW is not None:
                    _CACHE_EXPIRES_AT = time.time() + _CACHE_STALE_TTL
                    logger.warning("행사 API 빈 응답 – stale 캐시 연장")
        except Exception as e:
            logger.warning("행사 캐시 갱신 실패: %s", e)
            if _CACHE_RAW is not None:
                _CACHE_EXPIRES_AT = time.time() + _CACHE_STALE_TTL

    return _CACHE_RAW or []


# ─── 공개 인터페이스 ──────────────────────────────────────────

async def fetch_festivals_for_period(
    location: str,
    location_name: str,
    start_date: Optional[str],
    end_date: Optional[str],
) -> list[dict]:
    """여행 기간·지역에 해당하는 행사 목록 반환."""
    raw = await _get_raw_cached()
    return _filter_festivals_for_period(raw, location, location_name, start_date, end_date)


def _filter_festivals_for_period(
    raw: list[dict],
    location: str,
    location_name: str,
    start_date: Optional[str],
    end_date: Optional[str],
) -> list[dict]:
    if not start_date or not end_date:
        return []
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        return []
    if not raw:
        return []

    # 여행 기간에 걸친 월 목록
    months: set[tuple[int, int]] = set()
    cur = start_dt.replace(day=1)
    while cur <= end_dt:
        months.add((cur.year, cur.month))
        cur = cur.replace(month=cur.month + 1) if cur.month < 12 else cur.replace(year=cur.year + 1, month=1)

    keywords = _LOCATION_KEYWORDS.get(location, [location_name])

    all_items: list[dict] = []
    seen: set[str] = set()

    for year, month in sorted(months):
        _, last = monthrange(year, month)
        first_day = year * 10000 + month * 100 + 1
        last_day  = year * 10000 + month * 100 + last

        for item in raw:
            start_d = _date_int(item.get("fstvlStartDate") or item.get("축제시작일자") or "")
            end_s   = item.get("fstvlEndDate") or item.get("축제종료일자") or ""
            end_d   = _date_int(end_s) or start_d or 99991231
            if start_d is None:
                continue
            if not (start_d <= last_day and end_d >= first_day):
                continue

            addr = (
                item.get("opar", "")
                + item.get("rdnmadr", "")
                + item.get("lnmadr", "")
            )
            if not any(kw in addr for kw in keywords):
                continue

            dedup = (item.get("fstvlNm") or "") + (item.get("fstvlStartDate") or "")
            if dedup in seen:
                continue
            seen.add(dedup)
            all_items.append(_normalize_item(item))

    logger.info(
        "행사 필터 결과: location=%s 기간=%s~%s 건수=%d",
        location_name, start_date, end_date, len(all_items),
    )
    return all_items


def _current_week_cache_key() -> str:
    now = _utc_now()
    iso = now.isocalendar()
    return f"weekly:{iso.year}-W{iso.week:02d}"


def _current_week_bounds() -> tuple[str, str]:
    now = _utc_now()
    monday = now - timedelta(days=now.weekday())
    sunday = monday + timedelta(days=6)
    return monday.strftime("%Y-%m-%d"), sunday.strftime("%Y-%m-%d")


async def _cleanup_festival_cache(db: AsyncSession, current_week_key: str) -> None:
    await db.execute(
        delete(FestivalCache).where(
            (FestivalCache.expires_at < _utc_now()) | (FestivalCache.cache_key != current_week_key)
        )
    )


async def _get_weekly_raw_cache_db(
    db: AsyncSession,
    *,
    cache_key: str,
) -> list[dict] | None:
    result = await db.execute(
        select(FestivalCache).where(FestivalCache.cache_key == cache_key)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    if row.expires_at < _utc_now():
        await db.execute(delete(FestivalCache).where(FestivalCache.cache_key == cache_key))
        return None
    return row.festivals


async def _save_weekly_raw_cache_db(
    db: AsyncSession,
    *,
    cache_key: str,
    raw_items: list[dict],
) -> None:
    start_date, end_date = _current_week_bounds()
    expires_at = _utc_now() + timedelta(days=_DB_CACHE_TTL_DAYS)
    stmt = (
        pg_insert(FestivalCache)
        .values(
            cache_key=cache_key,
            location="__all__",
            start_date=start_date,
            end_date=end_date,
            festivals=raw_items,
            expires_at=expires_at,
        )
        .on_conflict_do_update(
            index_elements=["cache_key"],
            set_={
                "location": "__all__",
                "start_date": start_date,
                "end_date": end_date,
                "festivals": raw_items,
                "expires_at": expires_at,
            },
        )
    )
    await db.execute(stmt)


async def fetch_festivals_for_period_with_db_cache(
    db: AsyncSession,
    *,
    location: str,
    location_name: str,
    start_date: Optional[str],
    end_date: Optional[str],
) -> list[dict]:
    """DB 우선 행사 조회 (주 단위 원본 캐시).

    1) 이번 주 원본 행사 데이터(전국) DB 조회
    2) 미스 시 외부 API 전체 조회 후 DB 저장
    3) 요청 시점에 지역/기간 필터링
    4) 이전 주/만료 데이터 정리
    """
    if not start_date or not end_date:
        return []

    week_key = _current_week_cache_key()
    await _cleanup_festival_cache(db, week_key)

    raw = await _get_weekly_raw_cache_db(db, cache_key=week_key)
    if raw is None:
        raw = await _get_raw_cached()
        if raw:
            await _save_weekly_raw_cache_db(db, cache_key=week_key, raw_items=raw)
            logger.info("행사 주간 DB 캐시 저장: %s (원본 %d건)", week_key, len(raw))
    else:
        logger.info("행사 주간 DB 캐시 히트: %s (원본 %d건)", week_key, len(raw))

    return _filter_festivals_for_period(raw or [], location, location_name, start_date, end_date)
