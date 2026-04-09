"""Schedule-generation and post-processing nodes."""
import asyncio
import logging
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
    _get_llm_with_search,
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
from app.services.naver_map_client import geocode, keyword_search
from app.services.naver_place_hours import enrich_schedule_items_with_hours
from app.services.news_client import build_news_block_for_prompt, fetch_news_top10
from app.services.user_info_client import fetch_user_profile
from app.services.weather_client import build_weather_block_for_prompt, fetch_weather_for_planner

logger = logging.getLogger(__name__)

_TRAVEL_DAYS_DEFAULT = 2
# 웹 검색 선행 단계 응답 길이 상한 (토큰·지연 절약)
_WEB_CONTEXT_MAX_CHARS = 2000
# 선행 검색만 1분 미만으로 제한 (초과 시 빈 맥락으로 일정 생성 계속)
_WEB_GATHER_TIMEOUT_SEC = 55.0


async def gather_context_node(state: PlannerState) -> PlannerState:
    """프로필 · 행사 · 뉴스 · 날씨 · 웹 서칭을 **동시에** 수집하는 LangGraph 노드.

    각 데이터 소스는 독립적으로 비동기 실행되어 전체 대기 시간은
    가장 느린 소스 1개의 시간만큼만 걸린다.

    수집 결과는 PlannerState 필드에 저장되어 generate_schedule_node로 전달된다.
    """
    t0 = perf_counter()
    location = state["location"]
    location_name = state.get("location_name") or location
    user_id = state.get("user_id")
    start_date = state.get("start_date")
    end_date = state.get("end_date")
    use_search: bool = bool(state.get("use_search"))

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
            return await fetch_weather_for_planner(location_name, None, start_date, end_date)
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

    # 프로필 언어 확정 후 웹 검색 (언어에 맞는 쿼리를 써야 정확)
    web_ctx = ""
    if use_search:
        lang = _get_lang(profile)
        route_name = state.get("route_name") or ""
        try:
            web_ctx = await _gather_web_search_context(
                location_name=location_name,
                route_name=route_name,
                start_date=start_date,
                end_date=end_date,
                lang=lang,
            )
        except Exception as e:
            logger.warning("웹 검색 수집 실패: %s", e)

    logger.info(
        "컨텍스트 수집 완료: 행사=%d, 뉴스=%d, 날씨=%s, 웹검색=%d자 (%.2fs)",
        len(festivals), len(news), "O" if weather else "X", len(web_ctx), perf_counter() - t0,
    )
    return {
        **state,
        "user_profile": profile,
        "festivals": festivals,
        "news_top10": news,
        "weather_forecast": weather,
        "web_search_context": web_ctx or None,
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
            "불릿 목록으로만 간결히 정리하세요. JSON 금지. 한국어. 약 1200자 이내.\n"
            "출력은 본문만 (제목 없이)."
        )
    else:
        task = (
            f"Destination: {location_name}\n"
            f"Route theme: {route_name}\n"
            f"{date_clause}"
            "Use Google Search to find verifiable, current places and events "
            f"relevant to this trip within {location_name}. Bullet points only, no JSON, "
            f"~1200 chars max, in {lang}."
        )

    # max_output_tokens=600 전용 LLM 사용 → GoogleSearchAPIWrapper(k=5)와 동일한 효과
    # 검색 결과를 짧게 요약하므로 생성 토큰이 줄어 응답 시간이 단축된다.
    llm = _get_llm_search_context()
    t0 = perf_counter()
    try:
        response = await asyncio.wait_for(
            _invoke(llm, [HumanMessage(content=task)], plain_fallback=True),
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
    if not text:
        return ""
    if len(text) > _WEB_CONTEXT_MAX_CHARS:
        text = text[:_WEB_CONTEXT_MAX_CHARS] + "\n…(생략)"
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
    exclude_places: list[str] | None = None,
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
        excl_str = ", ".join(f'"{p}"' for p in exclude_places[:30])
        if lang == "Korean":
            excl_block = f"⛔ 다른 날 이미 포함된 장소 (절대 반복 금지): {excl_str}\n"
        else:
            excl_block = f"⛔ Already used in other days (NEVER repeat): {excl_str}\n"
    else:
        excl_block = ""

    if lang == "Korean":
        schema = (
            f'{{"day":{day_num},"date":"{date_str}","items":[{{"time":"{first_time}",'
            '"place":"장소명","address":"도로명주소","lat":37.5665,"lng":126.9780,'
            '"title":"활동명","description":"설명","tips":"팁","estimated_cost":"₩0"}'
            f'],"day_total":"₩0","day_total_krw":0}}'
        )
    else:
        schema = (
            f'{{"day":{day_num},"date":"{date_str}","items":[{{"time":"{first_time}",'
            '"place":"name","address":"street addr","lat":37.5665,"lng":126.9780,'
            '"title":"activity","description":"desc","tips":"tip","estimated_cost":"₩0"}'
            f'],"day_total":"₩0","day_total_krw":0}}'
        )
    prompt = (
        f"Destination:{location_name} | Route:{route_name} | Day:{day_num} ({date_str})\n"
        f"⚠️ ALL places must be within '{location_name}'.\n"
        f"{excl_block}\n"
        f"{web_search_block}"
        f"{user_block}{festival_block}{weather_block}{transport_block}{news_block}"
        f"Create 4 schedule items. time∈[{time_labels}]. "
        f"CLUSTER in same district. Order: {flow_hint}. "
        "estimated_cost in KRW. address: exact street addr. lat/lng: WGS84.\n"
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


async def _fix_duplicate_days(
    schedule: list[dict[str, Any]],
    per_day_costs: list[dict[str, Any]],
    date_list: list[str],
    common_kwargs: _SingleDayCommonKwargs,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """생성된 일정에서 여러 날에 중복 등장하는 장소를 감지하고,
    나중 날짜(더 높은 day 번호)만 exclude_places를 주어 재생성한다."""
    place_to_days: dict[str, list[int]] = {}
    for item in schedule:
        place = (item.get("place") or "").strip()
        day = int(item.get("day") or 0)
        if place and day:
            place_to_days.setdefault(place, [])
            if day not in place_to_days[place]:
                place_to_days[place].append(day)

    dup_days: set[int] = set()
    for days in place_to_days.values():
        if len(days) > 1:
            for d in sorted(days)[1:]:
                dup_days.add(d)

    if not dup_days:
        return schedule, per_day_costs

    logger.warning("중복 장소 감지 → Day %s 재생성", sorted(dup_days))

    for dup_day in sorted(dup_days):
        # 이 날을 제외한 모든 날의 장소를 exclude 목록으로
        exclude = list({
            (item.get("place") or "").strip()
            for item in schedule
            if item.get("day") != dup_day and item.get("place")
        })
        date_str = date_list[dup_day - 1]
        try:
            new_items, new_cost = await _generate_single_day(
                day_num=dup_day,
                date_str=date_str,
                exclude_places=exclude,
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
    """gather_context_node가 수집한 데이터를 받아 Day별 병렬 일정을 생성한다.

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
    # 없으면 use_search=True 일 때 직접 수집 (generate_schedule 단독 호출 호환).
    raw_ctx = state.get("web_search_context") or ""
    if not raw_ctx and bool(state.get("use_search")):
        raw_ctx = await _gather_web_search_context(
            location_name=location_name,
            route_name=route_name,
            start_date=start_date,
            end_date=end_date,
            lang=lang,
        )
    web_search_block = _format_web_search_block(raw_ctx, lang) if raw_ctx else ""

    if date_list:
        num_days = len(date_list)
        common_kwargs: _SingleDayCommonKwargs = {
            "num_days": num_days, "location_name": location_name, "route_name": route_name,
            "lang": lang, "lang_dir": lang_dir, "user_block": user_block, "festival_block": festival_block,
            "weather_block": weather_block, "transport_block": transport_block, "news_block": news_block,
            "web_search_block": web_search_block,
        }

        # 일(Day)별로 독립적으로 LLM 호출해 전부 병렬 실행한다.
        # - 1일 여행: LLM 1회 호출
        # - 3일 여행: LLM 3회 동시 호출 → 총 대기 시간 = max(day1, day2, day3)
        # 2일씩 묶는 방식은 출력 토큰이 2배로 늘어 응답이 오히려 느려지므로 제거했다.
        tasks = [
            _generate_single_day(day_num=i + 1, date_str=date_str, **common_kwargs)
            for i, date_str in enumerate(date_list)
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)  # type: ignore[assignment]

        merged_schedule: list[dict[str, Any]] = []
        per_day_costs: list[dict[str, Any]] = []
        errors: list[str] = []
        total_krw = 0
        for raw in results:
            if isinstance(raw, tuple) and len(raw) == 2:
                items, per_day_cost = raw[0], raw[1]
                merged_schedule.extend(items)
                per_day_costs.append(per_day_cost)
                total_krw += int(per_day_cost.get("total_krw") or 0)
            else:
                errors.append(str(raw) if isinstance(raw, BaseException) else repr(raw))
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
            '"place":"장소명","address":"도로명 주소","lat":37.5665,"lng":126.9780,'
            '"title":"활동명(≤20자)","description":"설명(≤60자)","tips":"팁(≤30자)","estimated_cost":"₩0"}}],'
            '"cost_summary":{"per_day":[{"day":1,"total":"₩0"}],"trip_total":"₩0"}}'
        )
    else:
        fb_schema = (
            f'{{"schedule":[{{"day":1,"date":"{date_example}","time":"{first_time}",'
            '"place":"place name","address":"street address","lat":37.5665,"lng":126.9780,'
            '"title":"activity title(≤20chars)","description":"description(≤60chars)","tips":"tip(≤30chars)","estimated_cost":"₩0"}}],'
            '"cost_summary":{"per_day":[{"day":1,"total":"₩0"}],"trip_total":"₩0"}}'
        )

    prompt = (
        f"Destination:{location_name} | Route:{route_name}\n"
        f"⚠️ GEOGRAPHIC CONSTRAINT (CRITICAL): ALL places must be physically located within '{location_name}'. "
        "Never use places from other cities or regions, even if names are similar.\n\n"
        f"{web_search_block}"
        f"{user_block}{festival_block}{weather_block}{transport_block}{news_block}"
        f"Create a detailed travel itinerary ({num_days} days, 4 items per day).\n\n"
        "Rules:\n"
        f"- Use only real existing places/restaurants/attractions within {location_name}\n"
        f"- time must be EXACTLY one of: {time_labels} (do NOT use any other value)\n"
        "- estimated_cost: cost in KRW (e.g. '무료', '₩3,000', '₩15,000~₩20,000')\n"
        "- cost_summary.per_day: sum of estimated_cost for each day\n"
        "- cost_summary.trip_total: grand total\n"
        "- address: exact street address\n"
        "- lat/lng: WGS84 decimal degree (approximate OK)\n"
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


async def _geocode_item(item: dict[str, Any], location_name: str = "") -> dict[str, Any]:
    """네이버로 좌표·주소를 보강하고, 가능하면 ‘실제 등록된 장소’인지 검증한다.

    1. Geocoding API: 도로명 주소 → 장소명 순 (공식 주소 DB)
    2. 지역 검색 API: 「장소명 + 여행지」→ 장소명만 (네이버 장소/상호 인덱스)

    Geocoding이 실패하거나 주소만 맞고 상호가 허구인 경우, 지역검색으로 POI를 찾으면
    좌표·주소·naver_place_id를 채우고 ``naver_verified=True`` 로 표시한다.
    끝까지 매칭되지 않으면 ``naver_verified=False`` (LLM이 넣은 lat/lng 유지).
    """
    place = (item.get("place") or "").strip()
    address = (item.get("address") or "").strip()
    region = (location_name or "").strip()

    for q in [x for x in [address, place] if x]:
        result = await geocode(q)
        if result:
            return {
                **item,
                "lat": float(result["y"]),
                "lng": float(result["x"]),
                "address": result.get("road_address") or result.get("address") or item.get("address", ""),
                "naver_verified": True,
                "naver_source": "geocode",
            }

    if not place:
        return {**item, "naver_verified": False, "naver_source": "none"}

    local_queries = [f"{place} {region}", place] if region else [place]
    for q in local_queries:
        ks = await keyword_search(q)
        if not ks:
            continue
        out: dict[str, Any] = {
            **item,
            "lat": float(ks["y"]),
            "lng": float(ks["x"]),
            "address": ks.get("address") or item.get("address", ""),
            "naver_verified": True,
            "naver_source": "local_search",
        }
        if ks.get("name"):
            out["naver_place_name"] = ks["name"]
        if ks.get("place_id"):
            out["naver_place_id"] = ks["place_id"]
        return out

    return {**item, "naver_verified": False, "naver_source": "none"}


async def geocode_schedule(state: PlannerState) -> PlannerState:
    schedule: list[dict[str, Any]] = state.get("schedule", [])
    if not schedule:
        return state
    loc = str(state.get("location_name") or state.get("location") or "").strip()
    geocoded = list(await asyncio.gather(*[_geocode_item(item, loc) for item in schedule]))
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

    if total_before > 0:
        logger.info("전체 경로 최적화 완료: %.1fkm → %.1fkm", total_before, total_after)
    return {**state, "schedule": optimized}


async def enrich_business_hours_schedule(state: PlannerState) -> PlannerState:
    if not settings.naver_place_hours_enabled:
        return state
    schedule = state.get("schedule") or []
    if not schedule:
        return state
    try:
        enriched = await enrich_schedule_items_with_hours(schedule)
        return {**state, "schedule": enriched}
    except Exception as e:
        logger.warning("영업시간 보강 실패(무시): %s", e)
        return state
