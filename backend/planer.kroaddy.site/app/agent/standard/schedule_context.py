# Context gathering/search helpers for standard planner.
import asyncio
import hashlib
import logging
from time import perf_counter
from typing import Any

from langchain_core.messages import HumanMessage

from app.agent.standard.nodes_common import (
    _extract_text_from_response,
    _format_festival_date,
    _get_lang,
    _get_llm,
    _get_llm_search_context,
    _invoke,
    _parse_json,
)
from app.agent.standard.state import PlannerState
from app.core.config import settings
from app.core.database.session import _get_async_session_factory
from app.services.festival_client import fetch_festivals_for_period_with_db_cache
from app.services.kakao_map_client import kakao_keyword_search_many
from app.services.naver_search_client import build_naver_tips_raw_text, naver_search_configured
from app.services.news_client import fetch_news_top10
from app.services.user_info_client import fetch_user_profile
from app.services.upstash_redis import upstash_cache_configured, upstash_get_str, upstash_setex_str
from app.services.weather_client import fetch_weather_for_planner

logger = logging.getLogger(__name__)
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


