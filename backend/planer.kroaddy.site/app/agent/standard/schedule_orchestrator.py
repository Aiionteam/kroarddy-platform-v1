"""Hub orchestration for standard schedule graph."""
import logging
from datetime import datetime, timedelta
from time import perf_counter
from typing import Any

from langchain_core.messages import HumanMessage

from app.agent.standard.nodes_common import (
    _build_transport_block,
    _build_user_profile_block,
    _format_festival_date,
    _get_lang,
    _get_llm,
    _invoke,
    _lang_directive,
    _parse_json,
)
from app.agent.standard.schedule_context import (
    _format_naver_tips_block,
    _format_web_search_block,
    _gather_naver_tips_context,
    _gather_web_search_context,
)
from app.agent.standard.schedule_daygen import (
    _SingleDayCommonKwargs,
    _banned_experience_block,
    _experience_tags_for_items,
    _fix_duplicate_days,
    _generate_single_day,
    _validate_full_trip_schedule,
    _venue_dedupe_key,
)
from app.agent.standard.state import PlannerState
from app.core.config import settings
from app.services.naver_place_hours import enrich_schedule_items_with_hours
from app.services.naver_search_client import naver_search_configured
from app.services.news_client import build_news_block_for_prompt
from app.services.weather_client import build_weather_block_for_prompt

logger = logging.getLogger(__name__)

_TRAVEL_DAYS_DEFAULT = 2


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


async def generate_schedule(state: PlannerState) -> PlannerState:
    """Orchestrate schedule generation from prepared state/context."""
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

        merged_schedule: list[dict[str, Any]] = []
        per_day_costs: list[dict[str, Any]] = []
        errors: list[str] = []
        cumulative_exclude: list[str] = []
        seen_raw_place: set[str] = set()
        seen_venue_keys: set[str] = set()

        def _append_exclude_from_day(items: list[dict[str, Any]]) -> None:
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
        "Use Kakao POI candidate names first for place/place_ko. "
        "Naver tips are guidance-only; venue names must be Kakao/Naver-searchable real names.\n"
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

