"""Schedule-generation and post-processing nodes."""
import asyncio
import hashlib
import logging
import re
from datetime import datetime, timedelta
from time import perf_counter
from typing import Any, TypedDict

from langchain_core.messages import HumanMessage

from app.agent.standard.nodes_common import (
    _build_transport_block,
    _build_user_profile_block,
    _extract_text_from_response,
    _format_festival_date,
    _get_lang,
    _get_llm,
    _get_llm_search_context,
    _haversine_km,
    _invoke,
    _lang_directive,
    _optimize_day_order,
    _parse_json,
    _total_route_km,
)
from app.agent.standard.state import PlannerState
from app.core.config import settings
from app.core.database.session import _get_async_session_factory
from app.services.festival_client import fetch_festivals_for_period_with_db_cache
from app.services.kakao_map_client import kakao_keyword_search_many, kakao_keyword_search_with_fallback
from app.services.naver_map_client import geocode
from app.services.naver_search_client import build_naver_tips_raw_text, naver_search_configured
from app.services.naver_place_hours import enrich_schedule_items_with_hours
from app.services.news_client import build_news_block_for_prompt, fetch_news_top10
from app.services.user_info_client import fetch_user_profile
from app.services.upstash_redis import upstash_cache_configured, upstash_get_str, upstash_setex_str
from app.services.weather_client import build_weather_block_for_prompt, fetch_weather_for_planner

logger = logging.getLogger(__name__)

# 대한민국 대략 경계 (LLM 좌표 유효성 검사)
_KR_LAT_MIN, _KR_LAT_MAX = 33.0, 38.8
_KR_LNG_MIN, _KR_LNG_MAX = 124.5, 132.0


def _parse_item_wgs84(item: dict[str, Any]) -> tuple[float, float] | None:
    """일정 항목의 lat/lng를 숫자로 파싱. 한국 영역 밖이면 None."""
    try:
        lat = float(item.get("lat"))
        lng = float(item.get("lng"))
    except (TypeError, ValueError):
        return None
    if not (_KR_LAT_MIN <= lat <= _KR_LAT_MAX and _KR_LNG_MIN <= lng <= _KR_LNG_MAX):
        return None
    return (lat, lng)

_TRAVEL_DAYS_DEFAULT = 2
# 웹 검색 선행 단계 응답 길이 상한 – 4000자로 여유 확대 (메인 LLM 참고 품질 향상)
_WEB_CONTEXT_MAX_CHARS = 4000
# 웹 검색은 보조 데이터 — 이 시간 내 미완료 시 빈 맥락으로 진행 (Gemini 검색·AFC 지연 대비)
_WEB_GATHER_TIMEOUT_SEC = 90.0
# 카카오 POI 풀(명소·맛집·카페) 프롬프트 상한 — 웹 맥락과 합쳐도 토큰 폭주 방지
_KAKAO_POI_CONTEXT_MAX_CHARS = 2800
# 네이버 블로그 스니펫 상한 – POI·웹과 합쳐도 토큰 과다 방지
_NAVER_TIPS_MAX_CHARS = 2200
_NAVER_TIPS_GATHER_TIMEOUT_SEC = 45.0


async def _noop_str() -> str:
    return ""


def _has_hangul(s: str) -> bool:
    return any("\uac00" <= c <= "\ud7a3" for c in (s or ""))


def _kakao_poi_axis_queries(anchor: str, lang: str) -> list[tuple[str, str]]:
    """(카카오 `query` 전체 문자열, 블록 라벨). region은 비우고 한 덩어리로 검색한다."""
    a = (anchor or "").strip()
    if not a:
        return []
    if lang == "Korean" or _has_hangul(a):
        return [
            (f"{a} 관광지", "관광지"),
            (f"{a} 맛집", "맛집"),
            (f"{a} 카페", "카페"),
        ]
    return [
        (f"{a} attraction", "Attraction"),
        (f"{a} restaurant", "Restaurant"),
        (f"{a} cafe", "Cafe"),
    ]


async def _llm_kakao_poi_search_anchor(
    *,
    location: str,
    location_name: str,
    route_name: str,
    lang: str,
) -> str:
    """카카오 3축(관광지·맛집·카페) 검색의 중심어. 실패 시 표기 지명."""
    base = (location_name or location or "").strip()
    if not base:
        return ""
    if not settings.kakao_poi_anchor_use_llm:
        return base[:48]
    if not settings.gemini_api_key:
        return base[:48]

    rn = (route_name or "").strip() or "(없음)"
    prompt = (
        "한국 여행 플래너가 카카오맵 **키워드 검색**에 넣을 중심어(앵커)를 한 개만 고른다.\n"
        "반드시 JSON만 출력하고 다른 텍스트는 쓰지 마라.\n\n"
        f"- URL 슬러그: {location}\n"
        f"- 표기 지명: {location_name}\n"
        f"- 선택 루트/테마: {rn}\n"
        f"- UI 언어: {lang}\n\n"
        "규칙:\n"
        "• 한글 2~12자 내외의 짧은 지명(산·호수·동네·관광단지·역 일대 등 검색에 잘 걸리는 말).\n"
        "• 루트명에 뚜렷한 랜드마크가 있으면 그쪽을 우선.\n"
        "• 예: 제주 한라 루트 → 한라산, 대구 호수 → 수성못, 서울 시내 → 종로 또는 강남 등 한 덩어리.\n"
        "• 불확실하면 표기 지명과 같아도 된다.\n\n"
        'JSON 형식: {"anchor":"한글또는짧은구"}'
    )
    try:
        llm = _get_llm()
        raw = await _invoke(llm, [HumanMessage(content=prompt)], plain_fallback=False, max_503_retries=0)
        data = _parse_json(raw)
        cand = (data.get("anchor") or "").strip()
        if 2 <= len(cand) <= 48:
            return cand
    except Exception as e:
        logger.warning("카카오 POI 앵커 LLM 실패, 표기 지명 사용: %s", e)
    return base[:48]


async def _gather_kakao_poi_pool_block(
    *,
    location: str,
    location_name: str,
    route_name: str,
    lang: str,
) -> str:
    """카카오 키워드 3축 — ``{앵커} 관광지`` / ``{앵커} 맛집`` / ``{앵커} 카페`` 고정 조회 → LLM용 RAG 블록.

    앵커는 ``kakao_poi_anchor_use_llm``이면 LLM이 슬러그·지명·루트로 추론하고, 아니면 ``location_name``만 쓴다.
    L1/L2(Neon) 일정 캐시와 무관. Upstash REST가 있으면 (앵커·루트·언어) 키로 L0 캐시.
    """
    display = (location_name or location or "").strip()
    if not display and not (location or "").strip():
        return ""
    if not settings.kakao_rest_api_key:
        return ""

    anchor = await _llm_kakao_poi_search_anchor(
        location=(location or "").strip(),
        location_name=(location_name or "").strip(),
        route_name=(route_name or "").strip(),
        lang=lang,
    )
    if not anchor:
        return ""
    logger.info("카카오 POI 검색 앵커: %s (표기=%s)", anchor, display or location)

    cache_key: str | None = None
    if upstash_cache_configured():
        rn = (route_name or "").strip()
        h = hashlib.sha256(f"{anchor}|{rn}|{lang}|kpv2".encode("utf-8")).hexdigest()
        cache_key = f"planer:std:kakao_poi:{h}"
        cached = await upstash_get_str(cache_key)
        if cached:
            return cached

    axis_specs = _kakao_poi_axis_queries(anchor, lang)
    if not axis_specs:
        return ""
    _axis_mode = "KO" if (lang == "Korean" or _has_hangul(anchor)) else "EN"
    logger.info(
        "[std_node] kakao_poi 키워드검색 축(%s) lang=%s anchor=%r queries=%s",
        _axis_mode,
        lang,
        anchor,
        [q for q, _ in axis_specs],
    )

    async def _axis(full_query: str) -> list[dict[str, Any]]:
        return await kakao_keyword_search_many(full_query, region="", size=8)

    try:
        gathers = [asyncio.create_task(_axis(q)) for q, _ in axis_specs]
        group_results = await asyncio.gather(*gathers)
    except Exception as e:
        logger.warning("카카오 POI 풀 수집 실패(무시): %s", e)
        return ""

    axis_labels = tuple(lbl for _, lbl in axis_specs)
    groups = tuple(group_results)
    seen: set[str] = set()
    lines: list[str] = []
    for label, rows in zip(axis_labels, groups, strict=True):
        for r in rows:
            nm = (r.get("name") or "").strip()
            if not nm:
                continue
            key = nm.casefold()
            if key in seen:
                continue
            seen.add(key)
            cat = (r.get("category") or "").strip()
            road = (r.get("road_address") or r.get("address") or "").strip()
            cat_part = f" ({cat})" if cat else ""
            addr_part = f" – {road[:42]}" if road else ""
            lines.append(f"  • [{label}]{cat_part} {nm}{addr_part}")

    if not lines:
        return ""

    body = "\n".join(lines)
    if len(body) > _KAKAO_POI_CONTEXT_MAX_CHARS:
        body = body[:_KAKAO_POI_CONTEXT_MAX_CHARS] + "\n…(생략)"

    if lang == "Korean":
        out = (
            "【카카오 지도 기준 실존 장소 후보 (우선 참고)】\n"
            "아래는 해당 여행지 근처에서 키워드로 조회한 **실제 상호** 샘플입니다. "
            "가능한 한 이 목록 또는 같은 생활권에서 검색되는 **실명 상호**만 사용하세요.\n"
            f"{body}\n\n"
        )
    else:
        out = (
            "【Kakao Map–verified POI candidates (prefer)】\n"
            "Real venue names from Kakao Local keyword search. Prefer these or other "
            "verifiable names in the same area.\n"
            f"{body}\n\n"
        )
    if cache_key:
        await upstash_setex_str(cache_key, settings.redis_cache_ttl_poi_sec, out)
    return out


async def gather_context_node(state: PlannerState) -> PlannerState:
    """프로필·행사·뉴스·날씨를 1차 병렬 수집한 뒤, **웹·카카오 POI·(옵션)네이버 팁을 2차 병렬**로 채운다.

    1차 `asyncio.gather`로 I/O 4종을 동시에 돌리고, 언어 확정 후
    `use_search`이면 Gemini 웹 검색, 아니면 네이버 블로그 규칙 검색(키 있을 때)과
    카카오(`{앵커} 관광지`·맛집·카페)를 동시에 돌려 **벽시계 대기**를 줄인다.
    L1 메모리·L2 Neon 일정 캐시 정책은 변경하지 않는다.

    수집 결과는 PlannerState에 저장되어 generate_schedule으로 전달된다.
    """
    t0 = perf_counter()
    location = state["location"]
    location_name = state.get("location_name") or location
    user_id = state.get("user_id")
    start_date = state.get("start_date")
    end_date = state.get("end_date")
    use_search: bool = bool(state.get("use_search"))
    logger.info(
        "[std_node] gather_context 시작 location=%s use_search=%s (1차: 프로필·행사·뉴스·날씨 병렬)",
        location,
        use_search,
    )

    # ── 각 에이전트 코루틴 정의 ───────────────────────────────────────────────

    async def _fetch_profile() -> dict | None:
        try:
            return await fetch_user_profile(user_id) if user_id else None
        except Exception as e:
            logger.warning("프로필 조회 실패: %s", e)
            return None

    async def _fetch_festivals() -> list:
        try:
            # gather_context_node는 자체 DB 세션을 생성해 사용한다
            factory = _get_async_session_factory()
            async with factory() as session:
                return await fetch_festivals_for_period_with_db_cache(
                    session,
                    location=location,
                    location_name=location_name,
                    start_date=start_date,
                    end_date=end_date,
                ) or []
        except Exception as e:
            logger.warning("행사 조회 실패: %s", e)
            return []

    async def _fetch_news() -> list:
        # 프론트에서 넘어온 뉴스가 있으면 그것을 우선 사용 (API 호출 생략)
        existing = state.get("news_top10")
        if existing:
            return existing
        try:
            return await fetch_news_top10(start_date, end_date) or []
        except Exception as e:
            logger.warning("뉴스 조회 실패: %s", e)
            return []

    async def _fetch_weather() -> dict | None:
        try:
            extras: list[str] = []
            if location and (location or "").strip() != (location_name or "").strip():
                extras.append(location)
            return await fetch_weather_for_planner(
                location_name,
                None,
                start_date,
                end_date,
                extra_geocode_names=tuple(extras),
            )
        except Exception as e:
            logger.warning("날씨 조회 실패: %s", e)
            return None

    # ── 5개 에이전트 병렬 실행 ────────────────────────────────────────────────
    # web_search는 profile이 있어야 lang을 확정할 수 있어, 프로필과 함께 먼저 실행
    profile, festivals, news, weather = await asyncio.gather(
        _fetch_profile(),
        _fetch_festivals(),
        _fetch_news(),
        _fetch_weather(),
    )

    logger.info(
        "[std_node] gather_context 1차 완료 행사=%d 뉴스=%d 날씨=%s 프로필=%s",
        len(festivals),
        len(news),
        "O" if weather else "X",
        "O" if profile else "X",
    )

    lang = _get_lang(profile)
    route_name = state.get("route_name") or ""
    web_search_gather_attempted = bool(use_search)
    naver_tips_gather_attempted = bool(
        (not use_search) and settings.naver_tips_context_enabled and naver_search_configured()
    )

    web_coro = (
        _gather_web_search_context(
            location_name=location_name,
            route_name=route_name,
            start_date=start_date,
            end_date=end_date,
            lang=lang,
        )
        if use_search
        else _noop_str()
    )
    poi_coro = _gather_kakao_poi_pool_block(
        location=location,
        location_name=location_name,
        route_name=route_name,
        lang=lang,
    )
    naver_coro = (
        _gather_naver_tips_context(
            location_name=location_name,
            route_name=route_name,
            lang=lang,
        )
        if naver_tips_gather_attempted
        else _noop_str()
    )

    _kakao_scheduled = bool(settings.kakao_rest_api_key)
    logger.info(
        "[std_node] gather_context 2차 병렬 시작 lang=%s | 웹검색=%s 카카오POI=%s 네이버팁=%s "
        "(행사 조회는 1차만; 카카오는 별도 키워드 3축)",
        lang,
        "O" if use_search else "X",
        "O" if _kakao_scheduled else "X(키없음)",
        "O" if naver_tips_gather_attempted else "X",
    )

    web_ctx = ""
    poi_block = ""
    naver_ctx = ""
    wr, pr, nr = await asyncio.gather(web_coro, poi_coro, naver_coro, return_exceptions=True)
    if isinstance(wr, Exception):
        logger.warning("웹 검색 수집 실패: %s", wr)
    elif use_search:
        web_ctx = wr or ""
    if isinstance(pr, Exception):
        logger.warning("카카오 POI 풀 수집 실패: %s", pr)
    else:
        poi_block = pr or ""
    if isinstance(nr, Exception):
        logger.warning("네이버 팁 수집 실패: %s", nr)
    elif naver_tips_gather_attempted:
        naver_ctx = nr or ""

    logger.info(
        "컨텍스트 수집 완료: 행사=%d, 뉴스=%d, 날씨=%s, 웹검색=%d자, 카카오POI=%d자, 네이버팁=%d자 (%.2fs)",
        len(festivals), len(news), "O" if weather else "X", len(web_ctx or ""),
        len(poi_block or ""), len(naver_ctx or ""), perf_counter() - t0,
    )
    _pb = poi_block or ""
    logger.debug(
        "[kakao_poi_ctx] gather→state chars=%d has_header=%s head=%r",
        len(_pb),
        ("카카오" in _pb or "Kakao" in _pb),
        (_pb[:120].replace("\n", " ") + ("…" if len(_pb) > 120 else "")),
    )
    return {
        **state,
        "user_profile": profile,
        "festivals": festivals,
        "news_top10": news,
        "weather_forecast": weather,
        "web_search_context": web_ctx or None,
        "web_search_gather_attempted": web_search_gather_attempted,
        "naver_tips_context": naver_ctx or None,
        "naver_tips_gather_attempted": naver_tips_gather_attempted,
        "kakao_poi_context_block": poi_block or None,
    }


def _format_web_search_block(raw: str, lang: str) -> str:
    """선행 웹 검색 텍스트를 Day 생성 프롬프트에 넣을 블록으로 감싼다."""
    t = (raw or "").strip()
    if not t:
        return ""
    if lang == "Korean":
        return "【웹 검색으로 확보한 최신 맥락 (일정에 우선 반영)】\n" + t + "\n\n"
    return "【Fresh context from web search (prioritize in the itinerary)】\n" + t + "\n\n"


async def _gather_web_search_context(
    *,
    location_name: str,
    route_name: str,
    start_date: str | None,
    end_date: str | None,
    lang: str,
) -> str:
    """Google Search grounding으로 여행지·기간·루트에 맞는 최신 맥락을 **한 번만** 수집한다.

    일정은 이후 단계에서 일반 Gemini만 사용하므로, Day별로 검색 도구를 반복 호출하지 않는다.
    """
    date_clause = ""
    if start_date and end_date:
        date_clause = f"여행 기간: {start_date} ~ {end_date}.\n" if lang == "Korean" else f"Trip dates: {start_date} ~ {end_date}.\n"

    if lang == "Korean":
        task = (
            f"목적지: {location_name}\n"
            f"선택 루트/테마: {route_name}\n"
            f"{date_clause}"
            "Google 검색으로, 위 조건에 맞는 **실제 존재하는** 식당·카페·명소·이벤트·"
            "최근 오픈·휴업·축제 등 검증 가능한 최신 정보를 조사하세요.\n"
            "아래 항목별로 구분해 불릿 목록으로 정리하세요. JSON 금지. 한국어. 약 2500자 이내.\n"
            "항목: 추천 명소/카페/맛집(이름·특징·주소), 현재 축제·이벤트, 교통·주의사항, 최근 변동사항.\n"
            "출력은 본문만 (제목 없이)."
        )
    else:
        task = (
            f"Destination: {location_name}\n"
            f"Route theme: {route_name}\n"
            f"{date_clause}"
            "Use Google Search to find verifiable, current information for this trip. "
            "Organize as bullet points (no JSON) under these sections: "
            "Recommended spots/cafes/restaurants (name, feature, address), "
            "Current festivals/events, Transport tips, Recent changes/closures. "
            f"~2500 chars max, in {lang}."
        )

    # max_output_tokens=600 전용 LLM 사용 → GoogleSearchAPIWrapper(k=5)와 동일한 효과
    # 검색 결과를 짧게 요약하므로 생성 토큰이 줄어 응답 시간이 단축된다.
    llm = _get_llm_search_context()
    t0 = perf_counter()
    try:
        response = await asyncio.wait_for(
            _invoke(llm, [HumanMessage(content=task)], plain_fallback=True, max_503_retries=1),
            timeout=_WEB_GATHER_TIMEOUT_SEC,
        )
    except asyncio.TimeoutError:
        logger.warning(
            "웹 맥락 수집 타임아웃(%.0fs) – 맥락 없이 일정 생성 진행",
            _WEB_GATHER_TIMEOUT_SEC,
        )
        return ""
    except Exception as e:
        logger.warning("웹 맥락 수집 실패: %s", e)
        return ""

    text = _extract_text_from_response(response).strip()
    logger.info("웹 맥락 수집 완료: %d자 (%.2fs)", len(text), perf_counter() - t0)
    # 100자 미만은 유의미한 정보가 없는 것으로 판단해 버린다 (쓰레기 데이터 프롬프트 오염 방지)
    if len(text) < 100:
        if text:
            logger.info("웹 맥락 너무 짧아 제외: %d자", len(text))
        return ""
    if len(text) > _WEB_CONTEXT_MAX_CHARS:
        text = text[:_WEB_CONTEXT_MAX_CHARS] + "\n…(생략)"
    return text


def _format_naver_tips_block(raw: str, lang: str) -> str:
    """네이버 블로그 스니펫을 Day 생성 프롬프트 블록으로 감싼다."""
    t = (raw or "").strip()
    if not t:
        return ""
    if lang == "Korean":
        return (
            "【네이버 블로그 기반 방문 팁·후기 요약 (참고용, 상호는 카카오 POI 목록 우선)】\n"
            + t
            + "\n\n"
        )
    return (
        "【Naver blog snippets – tips & reviews (reference; prefer Kakao POI names for places)】\n"
        + t
        + "\n\n"
    )


async def _gather_naver_tips_context(
    *,
    location_name: str,
    route_name: str,
    lang: str,
) -> str:
    """규칙 기반 블로그 검색으로 꿀팁 텍스트를 한 번에 수집한다 (Google Search 미사용 경로)."""
    if not settings.naver_tips_context_enabled or not naver_search_configured():
        return ""

    cache_key: str | None = None
    if upstash_cache_configured():
        rn = (route_name or "").strip()
        h = hashlib.sha256(f"{location_name}|{rn}|{lang}|ntv1".encode("utf-8")).hexdigest()
        cache_key = f"planer:std:naver_tips:{h}"
        cached = await upstash_get_str(cache_key)
        if cached:
            return cached

    t0 = perf_counter()
    try:
        text = await asyncio.wait_for(
            build_naver_tips_raw_text(
                location_name=location_name,
                route_name=route_name,
                lang=lang,
                max_chars=_NAVER_TIPS_MAX_CHARS,
            ),
            timeout=_NAVER_TIPS_GATHER_TIMEOUT_SEC,
        )
    except asyncio.TimeoutError:
        logger.warning(
            "네이버 팁 수집 타임아웃(%.0fs) – 맥락 없이 진행",
            _NAVER_TIPS_GATHER_TIMEOUT_SEC,
        )
        return ""
    except Exception as e:
        logger.warning("네이버 팁 수집 실패: %s", e)
        return ""

    text = (text or "").strip()
    logger.info("네이버 팁 수집 완료: %d자 (%.2fs)", len(text), perf_counter() - t0)
    if len(text) < 80:
        if text:
            logger.info("네이버 팁 너무 짧아 제외: %d자", len(text))
        return ""
    if cache_key:
        await upstash_setex_str(cache_key, settings.redis_cache_ttl_poi_sec, text)
    return text


def _build_date_list(start_date: str | None, end_date: str | None) -> list[str]:
    if not start_date or not end_date:
        return []
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        n = max(1, (end_dt - start_dt).days + 1)
        return [(start_dt + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(n)]
    except ValueError:
        return []


def _build_festival_block(festivals: list, lang: str = "Korean") -> str:
    if not festivals:
        return ""
    fest_lines: list[str] = []
    for f in festivals[:3]:
        name = f.get("fstvlNm", "")
        place = f.get("opar", "")
        s = _format_festival_date(f.get("fstvlStartDate", ""))
        e = _format_festival_date(f.get("fstvlEndDate", ""))
        content = f.get("fstvlCo", "")[:30]
        line = f"  • {name} ({place}, {s}~{e})"
        if content:
            line += f" – {content}"
        fest_lines.append(line)
    if lang == "Korean":
        header = "【여행 기간 행사】"
        footer = "- 관련 행사는 해당 날짜 일정에 포함하세요.\n"
    else:
        header = "【Local Events】"
        footer = "- Include matching events in the itinerary.\n"
    return header + "\n" + "\n".join(fest_lines) + "\n" + footer + "\n"


def _normalize_place_key(name: str) -> str:
    """중복 검사용: 공백·하이픈·중점 제거 + 소문자 (한·영 혼용 표기 흡수)."""
    s = (name or "").strip().lower()
    return re.sub(r"[\s\-_·\.]+", "", s)


# venue 중복 판별: LLM이 날마다 "청풍명월" / "제천 청풍명월" / "청풍명월 한정식"처럼 바꿔 쓰면 문자열 키만으로는 중복을 못 잡음
_VENUE_SUFFIX_STRIP_KO: tuple[str, ...] = (
    "한정식",
    "정식",
    "식당",
    "음식점",
    "레스토랑",
    "카페",
    "펜션",
    "맛집",
    "브런치",
    "커피",
    "베이커리",
)
_VENUE_SUFFIX_STRIP_EN: tuple[str, ...] = (
    "restaurant",
    "cafe",
    "bistro",
    "eatery",
    "pension",
    "guesthouse",
    "hotel",
)


def _strip_region_from_key(k: str, region: str) -> str:
    r = _normalize_place_key(region)
    if not r or not k:
        return k
    for prefix in (r, f"{r}시", f"{r}군", f"{r}구"):
        if k.startswith(prefix) and len(k) >= len(prefix) + 2:
            return k[len(prefix) :]
    return k


def _strip_venue_suffixes(k: str, lang: str) -> str:
    suffixes = _VENUE_SUFFIX_STRIP_KO if lang == "Korean" else _VENUE_SUFFIX_STRIP_EN
    changed = True
    while changed and len(k) >= 4:
        changed = False
        for suf in suffixes:
            sk = _normalize_place_key(suf)
            if len(sk) >= 2 and k.endswith(sk) and len(k) > len(sk) + 2:
                k = k[: -len(sk)]
                changed = True
                break
    return k


def _venue_dedupe_key(item: dict[str, Any], *, region: str, lang: str) -> str:
    """교차 일차 중복 검사용 키 (표기 변형 흡수)."""
    best = ""
    for fld in ("place", "place_ko"):
        raw = (item.get(fld) or "").strip()
        if not raw:
            continue
        k = _normalize_place_key(raw)
        k = _strip_region_from_key(k, region)
        k = _strip_venue_suffixes(k, lang)
        if len(k) > len(best):
            best = k
    return best


# (태그, 키워드…) — 이전 일차에 쓰인 '체험 유형'은 이후 일차 전 슬롯에서 금지
_EXPERIENCE_CATEGORIES_KO: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("rope_transport", ("케이블카", "케이블웨이", "로프웨이", "곤돌라")),
)
_EXPERIENCE_CATEGORIES_EN: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("rope_transport", ("cable car", "cableway", "ropeway", "gondola", "aerial tram")),
)


def _item_text_blob(item: dict[str, Any]) -> str:
    return " ".join(str(item.get(k) or "") for k in ("place", "place_ko", "title", "description", "tips"))


def _experience_tags_from_blob(blob: str, lang: str) -> set[str]:
    b = blob.lower()
    tags: set[str] = set()
    cats = _EXPERIENCE_CATEGORIES_KO if lang == "Korean" else _EXPERIENCE_CATEGORIES_EN
    for tag, kws in cats:
        for kw in kws:
            if kw.lower() in b:
                tags.add(tag)
                break
    return tags


def _experience_tags_for_items(items: list[dict[str, Any]], lang: str) -> set[str]:
    out: set[str] = set()
    for it in items:
        out |= _experience_tags_from_blob(_item_text_blob(it), lang)
    return out


def _banned_experience_block(used_tags: set[str], lang: str) -> str:
    if "rope_transport" not in used_tags:
        return ""
    if lang == "Korean":
        return (
            "【이번 일차 – 전일과 겹치면 안 되는 체험】\n"
            "공중 로프 이동 시설(케이블카·케이블웨이·로프웨이·곤돌라)은 **이미 다른 날 일정에 사용됨**. "
            "이번 날 4개 슬롯 **어느 것에도** 넣지 마세요. 산책·전망대(지상)·박물관·시장·온천·카페 등으로 대체.\n"
        )
    return (
        "【This day – no repeated experience type】\n"
        "Rope-based aerial transport (cable car, ropeway, gondola, etc.) already appears on another day. "
        "Do NOT include it in any of the 4 slots; use walks, ground viewpoints, museums, markets, spas, cafés.\n"
    )


class _SingleDayCommonKwargs(TypedDict):
    num_days: int
    location_name: str
    route_name: str
    lang: str
    lang_dir: str
    user_block: str
    festival_block: str
    weather_block: str
    transport_block: str
    news_block: str
    # use_search=True 이면 generate_schedule에서 선행 웹검색 후 채움 (Day 호출에는 검색 LLM 미사용)
    web_search_block: str
    # gather_context_node에서 카카오 병렬 수집 (없으면 "")
    poi_context_block: str
    # use_search=False·네이버 키 있을 때 블로그 스니펫 (없으면 "")
    naver_tips_block: str


async def _generate_single_day(
    *,
    day_num: int,
    date_str: str,
    num_days: int,
    location_name: str,
    route_name: str,
    lang: str,
    lang_dir: str,
    user_block: str,
    festival_block: str,
    weather_block: str,
    transport_block: str,
    news_block: str,
    web_search_block: str = "",
    poi_context_block: str = "",
    naver_tips_block: str = "",
    exclude_places: list[str] | None = None,
    experience_ban_prompt: str = "",
    retry_hint: str = "",
) -> tuple[list[dict[str, Any]], dict]:
    t0 = perf_counter()
    if lang == "Korean":
        time_labels = "오전|점심|오후|저녁"
        first_time = "오전"
        flow_hint = "오전→점심→오후→저녁"
    else:
        time_labels = "morning|lunch|afternoon|evening"
        first_time = "morning"
        flow_hint = "morning→lunch→afternoon→evening"

    day_zone_hint = f"- Day {day_num}/{num_days}: use a DIFFERENT district from other days.\n" if num_days > 1 else ""

    if exclude_places:
        excl_str = ", ".join(f'"{p}"' for p in exclude_places[:120])
        if lang == "Korean":
            excl_block = (
                f"⛔ 다른 날 이미 방문·포함한 장소 (절대 반복 금지): {excl_str}\n"
                "- 목록에는 상호명과 **시설 식별 키**(지명을 뺀 핵심 이름 등)가 섞여 있을 수 있습니다. "
                "키에 해당하는 **실제 동일 시설**은 표기를 바꿔도 다시 넣지 마세요.\n"
                "- 상호 표기가 달라도 **동일 시설**(같은 케이블카·같은 문화재단지·같은 교회·같은 전망대 등)이면 사용하지 마세요.\n"
            )
        else:
            excl_block = (
                f"⛔ Already used in other days (NEVER repeat): {excl_str}\n"
                "- Even if the name is spelled differently, do NOT reuse the **same venue** "
                "(same cable car line, same museum site, same observatory, etc.).\n"
            )
    else:
        excl_block = ""

    if lang == "Korean":
        schema = (
            f'{{"day":{day_num},"date":"{date_str}","items":[{{"time":"{first_time}",'
            '"place":"장소명","place_ko":"한국어 장소명",'
            '"title":"활동명","description":"설명","tips":"팁","estimated_cost":"₩0"}'
            f'],"day_total":"₩0","day_total_krw":0}}'
        )
    else:
        schema = (
            f'{{"day":{day_num},"date":"{date_str}","items":[{{"time":"{first_time}",'
            f'"place":"name in {lang}","place_ko":"한국어 장소명(지오코딩 전용)",'
            '"title":"activity","description":"desc","tips":"tip","estimated_cost":"₩0"}'
            f'],"day_total":"₩0","day_total_krw":0}}'
        )
    if lang == "Korean":
        place_rule_block = (
            "【장소명 필수 규칙】\n"
            "- place 필드에는 반드시 네이버/카카오맵에서 검색 가능한 실제 상호명·시설명만 입력하세요.\n"
            "- place_ko 필드에도 동일한 한국어 장소명을 반드시 입력하세요.\n"
            "- ❌ 금지: '~내 식당', '~근처 카페', '~에서 점심' 같은 모호한 묘사\n"
            "- ✅ 허용: '실학박물관', '기와집순두부 조안본점', '경복궁' 등 검색 가능한 실존 상호명\n"
            "- ⚠️ lat, lng, address 필드는 생성하지 마세요. 좌표·주소는 별도 시스템이 자동 입력합니다.\n"
        )
    else:
        place_rule_block = (
            "【Place name rules】\n"
            "- place field MUST be a real business/facility name searchable on Naver/Kakao Map.\n"
            "- place_ko field MUST contain the Korean name of the place (for geocoding).\n"
            "  e.g. '울산암각화박물관', '경복궁', '카페보라'\n"
            "- ❌ FORBIDDEN: vague descriptions like 'restaurant near X', 'café inside Y'.\n"
            "- ✅ REQUIRED: exact store/facility names like 'Gyeongbokgung Palace', 'Cafe Bora'.\n"
            "- ⚠️ Do NOT generate lat, lng, or address fields. Coordinates are filled by a separate system.\n"
        )

    if lang == "Korean":
        multi_trip = (
            f"⑤ 이번 여행은 총 {num_days}일입니다. **전체 기간**에서 같은 실제 장소(상호명이 같거나 같은 시설·케이블카·전망대·동일 유료 입장지)는 **단 하루·한 번만** 등장. "
            "다른 날에는 완전히 다른 거리·다른 테마의 장소만 배치하세요.\n"
            "⑥ 하루 4개 항목의 place는 **서로 모두 달라야** 합니다 (같은 날 같은 장소 2회 금지).\n"
            if num_days > 1
            else "⑤ 하루 4개 항목의 place는 **서로 모두 달라야** 합니다 (같은 날 같은 장소 2회 금지).\n"
        )
        constraint_block = (
            "【배치 규칙 – 반드시 준수】\n"
            "① 식사(점심·저녁) 항목은 하루에 최대 2개, 연속 슬롯에 **또 다른 식사·주요 식음료(한정식·코스·맛집 중심)** 배치 금지 "
            "(점심 식당 직후 오후에 또 비빔밥·한정식·대형 식사 코스 금지 — 산책·전시·시장·카페(가벼운 음료) 위주로).\n"
            "② 4개 장소는 반경 3km 이내 동일 생활권에 클러스터링 – 강남↔강북 왕복 동선 금지.\n"
            "③ time 슬롯(오전/점심/오후/저녁)과 **title·description·tips** 모두 일치: "
            "다른 슬롯의 식사·시간 표현 금지 (예: 점심 슬롯에 '저녁 식사'·'디너'·'하루 마무리'·'저녁 시간', 저녁 슬롯에 '점심'·'런치' 금지).\n"
            "④ 특정 날짜 행사(~에서 개막, ~일 한정 등)는 확인된 정보만 기재, "
            "불확실한 이벤트는 생략.\n"
            "⑦ 하루 네 곳이 **같은 단일 관광핵**(한 호수·한 공원 단지·한 산책로 일대)에만 몰이지 말고, "
            "**시내·다른 테마 권역**에 최소 1곳은 포함하세요.\n"
            "⑧ 리뷰·블로그 문장을 복붙하지 말 것. **점심** 슬롯 텍스트에 **저녁·밤·디너·야식** 등 저녁 묘사가 섞이면 안 됩니다.\n"
            f"{multi_trip}"
        )
    else:
        multi_trip = (
            f"⑤ This trip spans {num_days} days. Each **real POI** (same venue, cable car, observatory, paid attraction) may appear **only once in the entire trip**; other days must use different areas/themes.\n"
            "⑥ All 4 `place` values in this day must be **distinct** (no duplicate venue the same day).\n"
            if num_days > 1
            else "⑤ All 4 `place` values in this day must be **distinct** (no duplicate venue the same day).\n"
        )
        constraint_block = (
            "【Placement Rules – STRICTLY FOLLOW】\n"
            "① Max 2 heavy meals per day; do NOT place another **full meal / tasting course / restaurant-centric** slot "
            "immediately after lunch in the afternoon — use walks, sights, markets, or light café visits instead.\n"
            "② All 4 places MUST cluster within ~3km radius – no zig-zag routes across the city.\n"
            "③ `time` slot must match **title, description, and tips** — no wrong meal/time words "
            "(e.g. no 'dinner', 'evening meal', or 'evening time' in a lunch slot; no 'lunch' in an evening slot). "
            "Do NOT paste review text that refers to the wrong time of day.\n"
            "④ Only include dated events you are certain about; omit uncertain or unverified events.\n"
            "⑦ Do not put all four stops around the **same single landmark pocket** (one lake ring, one park only); "
            "include at least one stop in a **different district/theme** (e.g. downtown vs. outskirts).\n"
            f"{multi_trip}"
        )

    prompt = (
        f"Destination:{location_name} | Route:{route_name} | Day:{day_num} ({date_str})\n"
        f"⚠️ ALL places must be within '{location_name}'.\n"
        f"{excl_block}\n"
        f"{place_rule_block}"
        f"{constraint_block}"
        f"{experience_ban_prompt}"
        f"{retry_hint}"
        f"{web_search_block}"
        f"{poi_context_block}"
        f"{naver_tips_block}"
        f"{user_block}{festival_block}{weather_block}{transport_block}{news_block}"
        f"Create 4 schedule items. time∈[{time_labels}]. "
        f"CLUSTER in same district. Order: {flow_hint}. "
        "estimated_cost in KRW.\n"
        f"{day_zone_hint}{lang_dir}"
        "\nRespond ONLY with valid JSON:\n"
        f"{schema}"
    )
    # 웹 검색은 상위 단계에서 1회만 수행. 여기서는 일반 Gemini만 사용.
    llm = _get_llm()
    response = await _invoke(llm, [HumanMessage(content=prompt)], plain_fallback=False)
    data = _parse_json(response)
    raw_items = data.get("items", [])
    day_total_str = data.get("day_total", "₩0")
    day_total_krw = data.get("day_total_krw", 0)
    items = [{"day": day_num, "date": date_str, **{k: v for k, v in item.items() if k not in ("day", "date")}} for item in raw_items]
    per_day_cost = {"day": day_num, "total": day_total_str, "total_krw": day_total_krw}
    logger.info("일정 Day %d 생성 완료 (%s / %.2fs)", day_num, date_str, perf_counter() - t0)
    return items, per_day_cost


def _validate_full_trip_schedule(
    items_flat: list[dict[str, Any]],
    *,
    num_days: int,
    location_name: str,
    lang: str,
) -> tuple[bool, str]:
    """단일 응답 JSON이 규칙을 지켰는지 검사 (일차별 4슬롯·전체 장소 중복·로프 체험 1회)."""
    by_day: dict[int, list[dict[str, Any]]] = {}
    for it in items_flat:
        d = int(it.get("day") or 0)
        if d < 1:
            continue
        by_day.setdefault(d, []).append(it)

    for d in range(1, num_days + 1):
        arr = by_day.get(d, [])
        if len(arr) != 4:
            return False, f"day_{d}_count_{len(arr)}"

    seen_keys: set[str] = set()
    for it in items_flat:
        k = _venue_dedupe_key(it, region=location_name, lang=lang)
        if not k:
            continue
        if k in seen_keys:
            return False, f"dup_venue:{k}"
        seen_keys.add(k)

    for d, arr in by_day.items():
        ks = [_venue_dedupe_key(x, region=location_name, lang=lang) for x in arr]
        ks_n = [x for x in ks if x]
        if len(ks_n) != len(set(ks_n)):
            return False, f"same_day_dup:{d}"

    rope_n = 0
    for it in items_flat:
        if _experience_tags_from_blob(_item_text_blob(it), lang) & {"rope_transport"}:
            rope_n += 1
    if rope_n > 1:
        return False, "rope_transport_multi"

    return True, ""


async def _fix_duplicate_days(
    schedule: list[dict[str, Any]],
    per_day_costs: list[dict[str, Any]],
    date_list: list[str],
    common_kwargs: _SingleDayCommonKwargs,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """생성된 일정에서 여러 날에 중복 등장하는 장소를 감지하고,
    나중 날짜(더 높은 day 번호)만 exclude_places를 주어 재생성한다."""
    loc = common_kwargs["location_name"]
    clang = common_kwargs["lang"]
    place_to_days: dict[str, list[int]] = {}
    for item in schedule:
        key = _venue_dedupe_key(item, region=loc, lang=clang)
        day = int(item.get("day") or 0)
        if key and day:
            place_to_days.setdefault(key, [])
            if day not in place_to_days[key]:
                place_to_days[key].append(day)

    dup_days: set[int] = set()
    for days in place_to_days.values():
        if len(days) > 1:
            for d in sorted(days)[1:]:
                dup_days.add(d)

    if not dup_days:
        return schedule, per_day_costs

    logger.warning("중복 장소 감지 → Day %s 재생성", sorted(dup_days))

    for dup_day in sorted(dup_days):
        # 이 날을 제외한 모든 날의 장소 + 정규화 키를 exclude 목록으로
        exclude: list[str] = []
        seen_ex: set[str] = set()
        for item in schedule:
            if item.get("day") == dup_day:
                continue
            dk = _venue_dedupe_key(item, region=loc, lang=clang)
            if dk and dk not in seen_ex:
                seen_ex.add(dk)
                exclude.append(dk)
            for fld in ("place", "place_ko"):
                s = (item.get(fld) or "").strip()
                if s and s not in seen_ex:
                    seen_ex.add(s)
                    exclude.append(s)
        date_str = date_list[dup_day - 1]
        # 재생성 시에도 이전 일차 케이블카 등 체험 유형 금지 블록 적용
        prior_items = [it for it in schedule if int(it.get("day") or 0) < dup_day]
        exp_tags: set[str] = set()
        for it in prior_items:
            exp_tags |= _experience_tags_from_blob(_item_text_blob(it), common_kwargs["lang"])
        exp_ban = _banned_experience_block(exp_tags, common_kwargs["lang"])
        try:
            new_items, new_cost = await _generate_single_day(
                day_num=dup_day,
                date_str=date_str,
                exclude_places=exclude,
                experience_ban_prompt=exp_ban,
                **common_kwargs,
            )
        except Exception as exc:
            logger.warning("Day %d 재생성 실패(원본 유지): %s", dup_day, exc)
            continue
        schedule = [item for item in schedule if item.get("day") != dup_day]
        schedule.extend(new_items)
        per_day_costs = [c for c in per_day_costs if c.get("day") != dup_day]
        per_day_costs.append(new_cost)

    return schedule, per_day_costs


async def generate_schedule(state: PlannerState) -> PlannerState:
    """gather_context_node가 수집한 데이터를 받아 일정을 생성한다.

    날짜가 있으면 일차별로 **순차** LLM 호출을 하며, 앞선 일차 장소를 `exclude_places`로 넘겨
    교차 일차 중복을 줄인다. 이후 `_fix_duplicate_days`로 잔여 중복을 정리한다.

    - gather_context_node가 먼저 실행되었다면 state에 이미 모든 컨텍스트가 있다.
    - 직접 호출(스트리밍 엔드포인트 등) 시에도 state에서 데이터를 읽어 동작한다.
    """
    t0 = perf_counter()
    location_name = state.get("location_name") or state["location"]
    route_name = state.get("route_name") or ""
    start_date = state.get("start_date")
    end_date = state.get("end_date")
    user_profile: dict | None = state.get("user_profile")
    festivals: list = state.get("festivals") or []
    logger.info(
        "[std_node] generate_schedule 시작 location=%s 행사=%d건 (state의 gather 결과 사용)",
        location_name,
        len(festivals),
    )
    news_top10: list = state.get("news_top10") or []
    weather_forecast: dict | None = state.get("weather_forecast")
    transport_mode: str | None = state.get("transport_mode")

    lang = _get_lang(user_profile)
    lang_dir = _lang_directive(lang)
    user_block = _build_user_profile_block(user_profile, lang)
    news_block = build_news_block_for_prompt(news_top10, location_name, for_k_content=False, lang=lang)
    weather_block = build_weather_block_for_prompt(weather_forecast or {}, start_date, end_date)
    transport_block = _build_transport_block(transport_mode)
    festival_block = _build_festival_block(festivals, lang=lang)
    date_list = _build_date_list(start_date, end_date)

    # gather_context_node에서 이미 수집된 웹 검색 컨텍스트를 우선 사용한다.
    # gather에서 검색을 이미 시도했으면(성공/실패) 여기서는 재호출하지 않는다.
    # 없고 use_search=True이며 그래프 밖 단독 호출일 때만 직접 수집.
    raw_ctx = state.get("web_search_context") or ""
    if (
        not raw_ctx
        and bool(state.get("use_search"))
        and not state.get("web_search_gather_attempted")
    ):
        raw_ctx = await _gather_web_search_context(
            location_name=location_name,
            route_name=route_name,
            start_date=start_date,
            end_date=end_date,
            lang=lang,
        )
    web_search_block = _format_web_search_block(raw_ctx, lang) if raw_ctx else ""
    poi_context_block = state.get("kakao_poi_context_block") or ""

    raw_naver = state.get("naver_tips_context") or ""
    if (
        not raw_naver
        and not bool(state.get("use_search"))
        and settings.naver_tips_context_enabled
        and naver_search_configured()
        and not state.get("naver_tips_gather_attempted")
    ):
        raw_naver = await _gather_naver_tips_context(
            location_name=location_name,
            route_name=route_name,
            lang=lang,
        )
    naver_tips_block = _format_naver_tips_block(raw_naver, lang) if raw_naver else ""

    logger.debug(
        "[kakao_poi_ctx] generate_schedule←state chars=%d empty=%s head=%r",
        len(poi_context_block),
        not poi_context_block.strip(),
        ((poi_context_block[:120].replace("\n", " ") + "…") if len(poi_context_block) > 120 else poi_context_block.replace("\n", " ")),
    )

    if date_list:
        num_days = len(date_list)
        common_kwargs: _SingleDayCommonKwargs = {
            "num_days": num_days, "location_name": location_name, "route_name": route_name,
            "lang": lang, "lang_dir": lang_dir, "user_block": user_block, "festival_block": festival_block,
            "weather_block": weather_block, "transport_block": transport_block, "news_block": news_block,
            "web_search_block": web_search_block,
            "poi_context_block": poi_context_block,
            "naver_tips_block": naver_tips_block,
        }

        # 다일차: **순차** 생성 + 이전 일차 장소를 exclude_places로 넘겨 동일 시설(케이블카 등) 반복을 구조적으로 막는다.
        # (병렬 생성 시 각 Day가 서로를 모르고 웹 맥락만 보고 같은 명소를 고르는 문제가 있었음.)
        merged_schedule: list[dict[str, Any]] = []
        per_day_costs: list[dict[str, Any]] = []
        errors: list[str] = []
        cumulative_exclude: list[str] = []
        seen_raw_place: set[str] = set()
        seen_venue_keys: set[str] = set()

        def _append_exclude_from_day(items: list[dict[str, Any]]) -> None:
            """이전 일차 장소명 + 정규화 키(_venue_dedupe_key)를 누적해 표기만 바꾼 중복을 막는다."""
            for it in items:
                dk = _venue_dedupe_key(it, region=location_name, lang=lang)
                if dk and dk not in seen_venue_keys:
                    seen_venue_keys.add(dk)
                    cumulative_exclude.append(dk)
                for fld in ("place", "place_ko"):
                    s = (it.get(fld) or "").strip()
                    if s and s not in seen_raw_place:
                        seen_raw_place.add(s)
                        cumulative_exclude.append(s)

        for i, date_str in enumerate(date_list):
            try:
                items, per_day_cost = await _generate_single_day(
                    day_num=i + 1,
                    date_str=date_str,
                    exclude_places=list(cumulative_exclude) if cumulative_exclude else None,
                    **common_kwargs,
                )
            except BaseException as exc:
                errors.append(str(exc))
                continue
            merged_schedule.extend(items)
            per_day_costs.append(per_day_cost)
            _append_exclude_from_day(items)

        if merged_schedule:
            ok_val, val_reason = _validate_full_trip_schedule(
                merged_schedule, num_days=num_days, location_name=location_name, lang=lang
            )
            if not ok_val:
                logger.warning(
                    "순차 생성 후 전체 규칙 검사 실패 (%s). `_fix_duplicate_days`로 보정합니다.",
                    val_reason,
                )

        if errors and not merged_schedule:
            return {**state, "schedule": [], "cost_summary": None, "error": "; ".join(errors)}

        # 중복 장소 자동 수정
        merged_schedule, per_day_costs = await _fix_duplicate_days(
            merged_schedule, per_day_costs, date_list, common_kwargs
        )

        merged_schedule.sort(key=lambda x: (x.get("day", 0),))
        per_day_costs.sort(key=lambda x: int(x.get("day", 0)))
        total_krw = sum(int(c.get("total_krw") or 0) for c in per_day_costs)
        trip_total_str = f"₩{total_krw:,}" if total_krw else "N/A"
        merged_cost_summary: dict[str, Any] = {
            "per_day": [{"day": c["day"], "total": c["total"]} for c in per_day_costs],
            "trip_total": trip_total_str,
        }
        logger.info(
            "일정 생성 완료: %d개 항목 (%s / %s), 총경비=%s%s, %.2fs",
            len(merged_schedule), location_name, route_name, trip_total_str,
            f" | 부분 실패 {len(errors)}건" if errors else "", perf_counter() - t0,
        )
        return {**state, "schedule": merged_schedule, "cost_summary": merged_cost_summary, "error": None}

    num_days = _TRAVEL_DAYS_DEFAULT
    date_example = "YYYY-MM-DD"
    if lang == "Korean":
        time_labels = "오전|점심|오후|저녁"
        first_time = "오전"
        flow_hint = "오전→점심→오후→저녁"
    else:
        time_labels = "morning|lunch|afternoon|evening"
        first_time = "morning"
        flow_hint = "morning→lunch→afternoon→evening"

    if lang == "Korean":
        fb_schema = (
            f'{{"schedule":[{{"day":1,"date":"{date_example}","time":"{first_time}",'
            '"place":"장소명","place_ko":"한국어 장소명",'
            '"title":"활동명(≤20자)","description":"설명(≤60자)","tips":"팁(≤30자)","estimated_cost":"₩0"}}],'
            '"cost_summary":{"per_day":[{"day":1,"total":"₩0"}],"trip_total":"₩0"}}'
        )
    else:
        fb_schema = (
            f'{{"schedule":[{{"day":1,"date":"{date_example}","time":"{first_time}",'
            '"place":"place name","place_ko":"한국어 장소명",'
            '"title":"activity title(≤20chars)","description":"description(≤60chars)","tips":"tip(≤30chars)","estimated_cost":"₩0"}}],'
            '"cost_summary":{"per_day":[{"day":1,"total":"₩0"}],"trip_total":"₩0"}}'
        )

    prompt = (
        f"Destination:{location_name} | Route:{route_name}\n"
        f"⚠️ GEOGRAPHIC CONSTRAINT (CRITICAL): ALL places must be physically located within '{location_name}'. "
        "Never use places from other cities or regions, even if names are similar.\n\n"
        f"{web_search_block}"
        f"{poi_context_block}"
        f"{naver_tips_block}"
        f"{user_block}{festival_block}{weather_block}{transport_block}{news_block}"
        f"Create a detailed travel itinerary ({num_days} days, 4 items per day).\n\n"
        "Rules:\n"
        f"- Use only real existing places/restaurants/attractions within {location_name}\n"
        f"- place MUST be a real name searchable on Naver/Kakao Map (exact business name)\n"
        f"- place_ko MUST be the Korean name of the place (for geocoding)\n"
        f"- ⚠️ Do NOT generate lat, lng, or address fields — they are filled automatically\n"
        f"- time must be EXACTLY one of: {time_labels} (do NOT use any other value)\n"
        "- estimated_cost: cost in KRW (e.g. '무료', '₩3,000', '₩15,000~₩20,000')\n"
        "- cost_summary.per_day: sum of estimated_cost for each day\n"
        "- cost_summary.trip_total: grand total\n"
        "\n[GEOGRAPHIC EFFICIENCY – CRITICAL]\n"
        "- CLUSTER: Each day's 4 places must be in the SAME neighborhood/district.\n"
        f"- FLOW: Order {flow_hint} geographically close.\n"
        "- MULTI-DAY: Assign DIFFERENT districts to different days.\n"
        f"{lang_dir}\nRespond ONLY with valid JSON (no explanation):\n{fb_schema}"
    )
    try:
        llm = _get_llm()
        response = await _invoke(llm, [HumanMessage(content=prompt)], plain_fallback=False)
        data = _parse_json(response)
        fb_schedule = data.get("schedule") or []
        if not isinstance(fb_schedule, list):
            fb_schedule = []
        fb_cost_summary = data.get("cost_summary")
        return {**state, "schedule": fb_schedule, "cost_summary": fb_cost_summary, "error": None}
    except Exception as e:
        logger.exception("일정 생성 실패: %s", e)
        return {**state, "schedule": [], "cost_summary": None, "error": str(e)}


def _is_valid_korea_coord(lat: float, lng: float) -> bool:
    """WGS84 좌표가 대한민국 영토(본토+독도) 범위 내인지 확인."""
    return 33.0 <= lat <= 43.0 and 124.0 <= lng <= 132.0


def _region_prefix_for_place_query(region: str, name: str) -> str:
    """카카오 `region` 인자용 — 상호에 여행지가 이미 포함되면 중복 접두를 피한다.

    동일 상호가 전국에 있을 수 있으므로, 가능하면 `region + 상호`로 검색한다.
    `kakao_keyword_search`가 내부에서 `f'{region} {query}'`를 쓰므로 여기서는 접두를 이중으로 붙이지 않는다.
    """
    r = (region or "").strip()
    n = (name or "").strip()
    if not r or not n:
        return ""
    if r in n:
        return ""
    return r


async def _geocode_item(
    item: dict[str, Any],
    location_name: str = "",
) -> dict[str, Any]:
    """장소 좌표·주소를 카카오/네이버 API로 보강한다.

    우선순위:
    1. 카카오 키워드 검색 (POI DB) – 지역+상호로 지점 구분, 좌표·도로명 확보
    2. 네이버 Geocoding (주소 DB) – 도로명·지번 등 **주소형** 질의에 적합. 동일 상호 지점 선택은 불가에 가깝다.
    3. 전부 실패 → lat/lng=None, geocode_failed=True
    """
    place = (item.get("place") or "").strip()
    place_ko = (item.get("place_ko") or "").strip()
    address = (item.get("address") or "").strip()
    region = (location_name or "").strip()
    search_name = place_ko or place
    kakao_region = _region_prefix_for_place_query(region, search_name)

    # 1단계: 카카오 키워드 검색 (POI DB) ─────────────────────────────────────────
    # `kakao_keyword_search*`의 region 인자로 여행지를 넘기면 API가 `지역 + 상호`로 검색한다.
    if search_name:
        kr = await kakao_keyword_search_with_fallback(search_name, region=kakao_region)
        if not kr and kakao_region:
            # 지역 접두까지 맞춰도 실패하면 상호만 재시도 (희귀 상호·DB 누락 대비, 전국 동명이 있을 수 있음)
            kr = await kakao_keyword_search_with_fallback(search_name, region="")
        if kr:
            lat, lng = float(kr["y"]), float(kr["x"])
            logger.info(
                "카카오 검색 성공: region=%r q=%r → (%.5f, %.5f) [%s]",
                kakao_region or "(none)",
                search_name,
                lat,
                lng,
                kr.get("name", ""),
            )
            return {
                **item,
                "lat": lat,
                "lng": lng,
                "address": kr.get("road_address") or kr.get("address") or "",
                "naver_verified": True,
                "naver_source": "kakao_keyword",
                "geocode_failed": False,
                "kakao_place_name": kr.get("name", ""),
                "kakao_place_url": kr.get("place_url", ""),
            }

    # 2단계: 네이버 Geocoding (주소 DB) ────────────────────────────────────────────
    # POI·지점 구분은 카카오가 담당. 네이버는 "지역+상호"로 원하는 지점을 고르기 어렵고,
    # 좌표 확보 후 reverse 등 다른 API와 짝을 이룰 때 주소 문자열 기반 보조에 가깝다.
    for q in [x for x in [address, place_ko, place] if x]:
        result = await geocode(q)
        if result:
            lat, lng = float(result["y"]), float(result["x"])
            logger.info("네이버 지오코딩 성공: %s → (%.5f, %.5f)", q, lat, lng)
            return {
                **item,
                "lat": lat,
                "lng": lng,
                "address": result.get("road_address") or result.get("address") or "",
                "naver_verified": True,
                "naver_source": "naver_geocode",
                "geocode_failed": False,
            }

    # 3단계: 좌표 확보 실패 ─────────────────────────────────────────────────────
    logger.warning("좌표 확보 실패: place='%s' / place_ko='%s'", place, place_ko)
    return {**item, "lat": None, "lng": None, "naver_verified": False, "naver_source": "none", "geocode_failed": True}


_MEAL_KEYWORDS_KO = {
    "식당", "맛집", "음식점", "레스토랑", "한식", "중식", "일식", "양식", "분식",
    "카페", "베이커리", "브런치", "코스요리", "비빔밥", "삼겹살", "냉면", "순두부",
    "한정식", "정식", "풀코스", "밥상",
}
_MEAL_KEYWORDS_EN = {"restaurant", "cafe", "bistro", "eatery", "dining", "cuisine", "bakery", "brunch", "pizzeria", "grill"}
_TIME_SLOT_KO = {"오전": 0, "점심": 1, "오후": 2, "저녁": 3}
_TIME_SLOT_EN = {"morning": 0, "lunch": 1, "afternoon": 2, "evening": 3}
# 시간대 단어 – 다른 슬롯의 단어가 description에 있으면 경고
_TIME_WORDS_KO = [["오전", "아침"], ["점심", "런치"], ["오후"], ["저녁", "디너", "야식"]]
_TIME_WORDS_EN = [["morning", "breakfast"], ["lunch", "midday"], ["afternoon"], ["evening", "dinner", "supper"]]
_MAX_CLUSTER_KM = 8.0   # 하루 일정 내 최대 허용 이동 반경


def _schedule_slot_text_lower(item: dict[str, Any]) -> str:
    """time 슬롯 품질 검증용 — title·description·tips만 (place 제외)."""
    return (
        f"{item.get('title', '')} {(item.get('description') or '')} {item.get('tips', '')}"
    ).lower()


def _slot_lexicon_time_mismatch_warnings(item: dict[str, Any], lang: str) -> list[str]:
    """슬롯과 충돌하는 식사·시간대 어휘 (리뷰 문장 유입 등)."""
    sn = (item.get("time") or "").strip()
    sn_l = sn.lower()
    blob_l = _schedule_slot_text_lower(item)
    place = item.get("place")
    out: list[str] = []
    if lang == "Korean":
        if sn == "점심" and "저녁" in blob_l and "저녁까지" not in blob_l and "부터 저녁" not in blob_l:
            out.append(f"[시간모순] '{place}' (점심) 설명에 '저녁' 등 야간 묘사 포함")
        elif sn == "오후" and "저녁" in blob_l and any(
            x in blob_l for x in ("풀코스", "코스요리", "한정식", "식사", "맛집", "비빔밥", "정식")
        ):
            out.append(f"[시간모순] '{place}' (오후)에 저녁·본식 식사형 문구 포함")
        elif sn == "저녁" and ("점심" in blob_l or "런치" in blob_l) and any(
            x in blob_l for x in ("식사", "메뉴", "코스", "밥", "맛집")
        ):
            out.append(f"[시간모순] '{place}' (저녁)에 점심·런치 식사형 문구 포함")
    else:
        if sn_l == "lunch" and any(w in blob_l for w in ("dinner", "evening meal", "supper")):
            out.append(f"[time_mismatch] '{place}' (lunch) mentions dinner/evening meal wording")
        elif sn_l == "afternoon" and "dinner" in blob_l and any(
            x in blob_l for x in ("full course", "course menu", "restaurant", "bibimbap")
        ):
            out.append(f"[time_mismatch] '{place}' (afternoon) has dinner-style meal wording")
        elif sn_l == "evening" and "lunch" in blob_l and any(
            x in blob_l for x in ("meal", "menu", "course", "restaurant")
        ):
            out.append(f"[time_mismatch] '{place}' (evening) has lunch-style meal wording")
    return out


def _validate_day_items(items: list[dict[str, Any]], lang: str = "Korean") -> list[str]:
    """일정 항목 품질 검증 – 문제 항목 설명 목록 반환 (로그용).

    검사 항목:
    1. 연속 식사 슬롯
    2. 시간대+행위 불일치, 슬롯·어휘 직접 충돌
    3. 연속 장소 간 과도한 이동 (>8km)
    """
    warnings: list[str] = []
    time_slot_map = _TIME_SLOT_KO if lang == "Korean" else _TIME_SLOT_EN
    time_words = _TIME_WORDS_KO if lang == "Korean" else _TIME_WORDS_EN
    meal_kw = _MEAL_KEYWORDS_KO if lang == "Korean" else _MEAL_KEYWORDS_EN

    def _is_meal(item: dict) -> bool:
        text = f"{item.get('place','')} {item.get('title','')} {item.get('description','')}".lower()
        return any(k in text for k in meal_kw)

    # 1. 연속 식사 감지
    for i in range(len(items) - 1):
        if _is_meal(items[i]) and _is_meal(items[i + 1]):
            warnings.append(
                f"[연속식사] {items[i].get('time')}→{items[i+1].get('time')}: "
                f"'{items[i].get('place')}' 다음 '{items[i+1].get('place')}'"
            )

    # 2. 시간대+행위 조합 불일치 (단순 시간 언급은 무시, "저녁 식사"/"점심 메뉴" 등만 감지)
    _action_ko = ("식사", "메뉴", "요리", "코스", "맛집", "먹")
    _action_en = ("meal", "menu", "food", "dish", "eat", "dine", "cuisine")
    action_words = _action_ko if lang == "Korean" else _action_en
    for item in items:
        slot_name = (item.get("time") or "").strip().lower()
        slot_idx = time_slot_map.get(slot_name, -1)
        if slot_idx < 0:
            continue
        blob = _schedule_slot_text_lower(item)
        for other_idx, words in enumerate(time_words):
            if other_idx == slot_idx:
                continue
            for w in words:
                if w not in blob:
                    continue
                # "저녁 식사", "점심 메뉴" 처럼 시간대+행위 조합인 경우만 경고
                w_pos = blob.find(w)
                context = blob[w_pos : w_pos + len(w) + 6]
                if any(a in context for a in action_words):
                    warnings.append(
                        f"[시간불일치] '{item.get('place')}' ({slot_name} 슬롯) "
                        f"title/description/tips에 '{w}+행위' 포함"
                    )
                    break

    for item in items:
        warnings.extend(_slot_lexicon_time_mismatch_warnings(item, lang))

    # 3. 연속 장소 간 과도한 이동 거리
    for i in range(len(items) - 1):
        a, b = items[i], items[i + 1]
        if not (a.get("lat") and a.get("lng") and b.get("lat") and b.get("lng")):
            continue
        try:
            dist = _haversine_km(float(a["lat"]), float(a["lng"]), float(b["lat"]), float(b["lng"]))
            if dist > _MAX_CLUSTER_KM:
                warnings.append(
                    f"[동선이탈] '{a.get('place')}' → '{b.get('place')}': {dist:.1f}km "
                    f"(허용 {_MAX_CLUSTER_KM}km 초과)"
                )
        except Exception:
            pass

    return warnings


async def _fix_failed_places(
    failed_items: list[dict[str, Any]],
    location_name: str,
    lang: str,
) -> list[dict[str, Any]]:
    """지오코딩 실패 장소를 LLM에게 대체 추천받아 재검색한다. 최대 1회."""
    if not failed_items:
        return []

    names = [item.get("place_ko") or item.get("place") or "?" for item in failed_items]
    logger.info("지오코딩 실패 %d건 대체 장소 요청: %s", len(failed_items), names)

    if lang == "Korean":
        prompt = (
            f"아래 장소들은 '{location_name}'에서 카카오맵/네이버맵으로 검색할 수 없습니다.\n"
            "각 장소를 같은 테마·같은 지역의 실제 존재하는 대체 장소로 바꿔주세요.\n"
            "반드시 카카오맵에서 검색 가능한 실존 상호명·시설명만 사용하세요.\n\n"
            f"검색 불가 장소: {names}\n\n"
            "JSON 배열로만 응답하세요:\n"
            '[{"original":"검색불가장소명","replacement":"대체장소명","place_ko":"한국어명"}]'
        )
    else:
        prompt = (
            f"The following places could not be found on Kakao/Naver Map in '{location_name}'.\n"
            "Replace each with a real, searchable alternative in the same area and theme.\n\n"
            f"Not found: {names}\n\n"
            "Respond ONLY with a JSON array:\n"
            '[{"original":"unfound name","replacement":"alternative name","place_ko":"Korean name"}]'
        )

    try:
        llm = _get_llm()
        response = await _invoke(llm, [HumanMessage(content=prompt)], max_503_retries=1)
        data = _parse_json(response)
        replacements: list[dict] = data if isinstance(data, list) else data.get("replacements", data.get("items", []))
    except Exception as e:
        logger.warning("대체 장소 LLM 호출 실패: %s", e)
        return failed_items

    replacement_map: dict[str, dict] = {}
    for r in replacements:
        orig = (r.get("original") or "").strip()
        if orig:
            replacement_map[orig] = r

    fixed: list[dict[str, Any]] = []
    re_geocode_tasks = []
    for item in failed_items:
        orig_name = (item.get("place_ko") or item.get("place") or "").strip()
        rep = replacement_map.get(orig_name)
        if rep:
            new_place = (rep.get("replacement") or "").strip()
            new_place_ko = (rep.get("place_ko") or new_place).strip()
            if new_place:
                patched = {**item, "place": new_place, "place_ko": new_place_ko, "_replaced_from": orig_name}
                re_geocode_tasks.append(patched)
                continue
        fixed.append(item)

    if re_geocode_tasks:
        loc = (location_name or "").strip()
        re_results = await asyncio.gather(*[_geocode_item(p, loc) for p in re_geocode_tasks])
        for result in re_results:
            if result.get("geocode_failed"):
                logger.warning("대체 장소도 검색 실패: '%s'", result.get("place"))
            else:
                logger.info(
                    "대체 장소 성공: '%s' → '%s' (%.5f, %.5f)",
                    result.get("_replaced_from", ""),
                    result.get("place"),
                    result.get("lat", 0),
                    result.get("lng", 0),
                )
            fixed.append(result)

    return fixed


async def geocode_schedule(state: PlannerState) -> PlannerState:
    schedule: list[dict[str, Any]] = state.get("schedule", [])
    logger.info("[std_node] geocode_schedule 시작 일정=%d건", len(schedule))
    if not schedule:
        return state
    loc = str(state.get("location_name") or state.get("location") or "").strip()
    lang = _get_lang(state.get("user_profile"))

    # ── 1차: 전체 병렬 지오코딩 ──────────────────────────────────────────────
    geocoded = list(await asyncio.gather(*[
        _geocode_item(item, loc)
        for item in schedule
    ]))

    # ── 2차: 실패 항목 대체 장소 재생성 (1회) ────────────────────────────────
    failed = [item for item in geocoded if item.get("geocode_failed")]
    if failed:
        logger.info("지오코딩 실패 %d/%d건 → 대체 장소 요청", len(failed), len(geocoded))
        fixed = await _fix_failed_places(failed, loc, lang)
        fixed_map = {id(orig): repl for orig, repl in zip(failed, fixed)}
        geocoded = [fixed_map.get(id(item), item) if item.get("geocode_failed") else item for item in geocoded]

    # ── 경로 최적화 + 품질 검증 ──────────────────────────────────────────────
    days_map: dict[int, list[dict[str, Any]]] = {}
    for item in geocoded:
        d = item.get("day", 1)
        days_map.setdefault(d, []).append(item)

    optimized: list[dict[str, Any]] = []
    total_before = 0.0
    total_after = 0.0
    for day_num in sorted(days_map.keys()):
        day_items = days_map[day_num]
        before_km = _total_route_km(day_items)
        reordered = _optimize_day_order(day_items)
        after_km = _total_route_km(reordered)
        total_before += before_km
        total_after += after_km
        optimized.extend(reordered)
        logger.info("Day%d 경로 최적화: %.1fkm → %.1fkm", day_num, before_km, after_km)

        issues = _validate_day_items(reordered, lang=lang)
        if issues:
            logger.warning(
                "Day%d 일정 품질 이슈 %d건:\n  %s",
                day_num, len(issues), "\n  ".join(issues),
            )
        else:
            logger.info("Day%d 일정 품질 검증 통과", day_num)

    if total_before > 0:
        logger.info("전체 경로 최적화 완료: %.1fkm → %.1fkm", total_before, total_after)
    return {**state, "schedule": optimized}


async def enrich_business_hours_schedule(state: PlannerState) -> PlannerState:
    if not settings.naver_place_hours_enabled:
        logger.info("[std_node] enrich_business_hours 건너뜀 (설정 비활성)")
        return state
    schedule = state.get("schedule") or []
    logger.info("[std_node] enrich_business_hours 시작 일정=%d건", len(schedule))
    if not schedule:
        return state
    try:
        enriched = await enrich_schedule_items_with_hours(schedule)
        return {**state, "schedule": enriched}
    except Exception as e:
        logger.warning("영업시간 보강 실패(무시): %s", e)
        return state
