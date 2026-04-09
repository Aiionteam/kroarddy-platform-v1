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
    _format_festival_date,
    _get_lang,
    _get_llm_with_search,
    _invoke,
    _lang_directive,
    _optimize_day_order,
    _parse_json,
    _total_route_km,
)
from app.agent.standard.state import PlannerState
from app.core.config import settings
from app.services.naver_map_client import geocode
from app.services.naver_place_hours import enrich_schedule_items_with_hours
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
        f"{user_block}{festival_block}{weather_block}{transport_block}{news_block}"
        f"Create 4 schedule items. time∈[{time_labels}]. "
        f"CLUSTER in same district. Order: {flow_hint}. "
        "estimated_cost in KRW. address: exact street addr. lat/lng: WGS84.\n"
        f"{day_zone_hint}{lang_dir}"
        "\nRespond ONLY with valid JSON:\n"
        f"{schema}"
    )
    llm = _get_llm_with_search()
    response = await _invoke(llm, [HumanMessage(content=prompt)], plain_fallback=True)
    data = _parse_json(response)
    raw_items = data.get("items", [])
    day_total_str = data.get("day_total", "₩0")
    day_total_krw = data.get("day_total_krw", 0)
    items = [{"day": day_num, "date": date_str, **{k: v for k, v in item.items() if k not in ("day", "date")}} for item in raw_items]
    per_day_cost = {"day": day_num, "total": day_total_str, "total_krw": day_total_krw}
    logger.info("일정 Day %d 생성 완료 (%s / %.2fs)", day_num, date_str, perf_counter() - t0)
    return items, per_day_cost


async def _generate_two_days(
    *,
    day_pairs: list[tuple[int, str]],
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
    exclude_places: list[str] | None = None,
) -> list[tuple[list[dict[str, Any]], dict]]:
    """2일치를 한 번의 LLM 호출로 생성해 호출 수를 절반으로 줄인다."""
    t0 = perf_counter()
    if lang == "Korean":
        time_labels = "오전|점심|오후|저녁"
        first_time = "오전"
        flow_hint = "오전→점심→오후→저녁"
    else:
        time_labels = "morning|lunch|afternoon|evening"
        first_time = "morning"
        flow_hint = "morning→lunch→afternoon→evening"

    days_desc = " & ".join(f"Day{d}({ds})" for d, ds in day_pairs)

    if exclude_places:
        excl_str = ", ".join(f'"{p}"' for p in exclude_places[:30])
        if lang == "Korean":
            excl_block = f"⛔ 다른 날 이미 포함된 장소 (절대 반복 금지): {excl_str}\n"
        else:
            excl_block = f"⛔ Already used in other days (NEVER repeat): {excl_str}\n"
    else:
        excl_block = ""

    if lang == "Korean":
        item_tpl = '"place":"장소명","address":"도로명주소","lat":37.5665,"lng":126.9780,"title":"활동명","description":"설명","tips":"팁","estimated_cost":"₩0"'
    else:
        item_tpl = '"place":"name","address":"street addr","lat":37.5665,"lng":126.9780,"title":"activity","description":"desc","tips":"tip","estimated_cost":"₩0"'
    schema_days = ",".join(
        f'{{"day":{d},"date":"{ds}","items":[{{"time":"{first_time}",{item_tpl}}}],"day_total":"₩0","day_total_krw":0}}'
        for d, ds in day_pairs
    )
    schema = '{"days":[' + schema_days + "]}"

    prompt = (
        f"Destination:{location_name} | Route:{route_name} | {days_desc}\n"
        f"⚠️ ALL places must be within '{location_name}'. Total days={num_days}.\n"
        f"{excl_block}\n"
        f"{user_block}{festival_block}{weather_block}{transport_block}{news_block}"
        f"Create 4 schedule items per day for {days_desc}. "
        f"time∈[{time_labels}]. Each day MUST use a COMPLETELY DIFFERENT district – "
        "NO place may appear in more than one day. "
        f"CLUSTER each day's items in same area. Order: {flow_hint}. "
        "estimated_cost in KRW. address: exact street addr. lat/lng: WGS84.\n"
        f"{lang_dir}"
        "\nRespond ONLY with valid JSON:\n"
        f"{schema}"
    )
    llm = _get_llm_with_search()
    response = await _invoke(llm, [HumanMessage(content=prompt)], plain_fallback=True)
    data = _parse_json(response)

    raw_days: list[dict[str, Any]] = data.get("days", [])
    results: list[tuple[list[dict[str, Any]], dict]] = []
    for i, (day_num, date_str) in enumerate(day_pairs):
        day_data = raw_days[i] if i < len(raw_days) else {}
        raw_items = day_data.get("items", [])
        day_total_str = day_data.get("day_total", "₩0")
        day_total_krw = int(day_data.get("day_total_krw", 0) or 0)
        items = [{"day": day_num, "date": date_str, **{k: v for k, v in it.items() if k not in ("day", "date")}} for it in raw_items]
        results.append((items, {"day": day_num, "total": day_total_str, "total_krw": day_total_krw}))

    logger.info("일정 2일묶음 생성 완료: %s (%s / %.2fs)", days_desc, location_name, perf_counter() - t0)
    return results


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

    if date_list:
        num_days = len(date_list)
        common_kwargs: _SingleDayCommonKwargs = {
            "num_days": num_days, "location_name": location_name, "route_name": route_name,
            "lang": lang, "lang_dir": lang_dir, "user_block": user_block, "festival_block": festival_block,
            "weather_block": weather_block, "transport_block": transport_block, "news_block": news_block,
        }

        # 3일 이상이면 2일씩 묶어 LLM 호출 수를 절반으로 줄인다.
        if num_days >= 3:
            pairs: list[list[tuple[int, str]]] = []
            for i in range(0, len(date_list), 2):
                pair = [(i + 1, date_list[i])]
                if i + 1 < len(date_list):
                    pair.append((i + 2, date_list[i + 1]))
                pairs.append(pair)
            batch_tasks = [_generate_two_days(day_pairs=p, **common_kwargs) for p in pairs]
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            # flatten: each batch result is list[tuple[items, cost]]
            flat_results: list[tuple[list[dict[str, Any]], dict] | BaseException] = []
            for br in batch_results:
                if isinstance(br, BaseException):
                    flat_results.append(br)
                else:
                    flat_results.extend(br)  # type: ignore[arg-type]
            results = flat_results  # type: ignore[assignment]
        else:
            tasks = [_generate_single_day(day_num=i + 1, date_str=date_str, **common_kwargs) for i, date_str in enumerate(date_list)]
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
    llm = _get_llm_with_search()
    try:
        response = await _invoke(llm, [HumanMessage(content=prompt)], plain_fallback=True)
        data = _parse_json(response)
        fb_schedule = data.get("schedule") or []
        if not isinstance(fb_schedule, list):
            fb_schedule = []
        fb_cost_summary = data.get("cost_summary")
        return {**state, "schedule": fb_schedule, "cost_summary": fb_cost_summary, "error": None}
    except Exception as e:
        logger.exception("일정 생성 실패: %s", e)
        return {**state, "schedule": [], "cost_summary": None, "error": str(e)}


async def _geocode_item(item: dict[str, Any]) -> dict[str, Any]:
    queries = []
    if item.get("address"):
        queries.append(item["address"])
    if item.get("place"):
        queries.append(item["place"])
    for q in queries:
        result = await geocode(q)
        if result:
            return {
                **item,
                "lat": float(result["y"]),
                "lng": float(result["x"]),
                "address": result.get("road_address") or result.get("address") or item.get("address", ""),
            }
    return item


async def geocode_schedule(state: PlannerState) -> PlannerState:
    schedule: list[dict[str, Any]] = state.get("schedule", [])
    if not schedule:
        return state
    geocoded = list(await asyncio.gather(*[_geocode_item(item) for item in schedule]))
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
