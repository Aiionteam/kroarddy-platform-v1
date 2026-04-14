"""Geocoding and post-geocode validation for standard planner."""
import asyncio
import logging
import re
from typing import Any

from langchain_core.messages import HumanMessage

from app.agent.standard.nodes_common import (
    _get_lang,
    _get_llm,
    _haversine_km,
    _invoke,
    _optimize_day_order,
    _parse_json,
    _total_route_km,
)
from app.agent.standard.state import PlannerState
from app.services.kakao_map_client import kakao_keyword_search_with_fallback
from app.services.naver_map_client import geocode

logger = logging.getLogger(__name__)


def _is_valid_korea_coord(lat: float, lng: float) -> bool:
    """WGS84 좌표가 대한민국 영토(본토+독도) 범위 내인지 확인."""
    return 33.0 <= lat <= 43.0 and 124.0 <= lng <= 132.0


def _region_prefix_for_place_query(region: str, name: str) -> str:
    """카카오 `region` 인자용 — 상호에 여행지가 이미 포함되면 중복 접두를 피한다."""
    r = (region or "").strip()
    n = (name or "").strip()
    if not r or not n:
        return ""
    if r in n:
        return ""
    return r


def _build_geocode_query_variants(*names: str) -> list[str]:
    """지오코딩 실패를 줄이기 위한 질의 변형 목록을 만든다."""
    out: list[str] = []
    seen: set[str] = set()

    def _push(q: str) -> None:
        s = (q or "").strip()
        if not s:
            return
        key = s.casefold()
        if key in seen:
            return
        seen.add(key)
        out.append(s)

    suffixes = (
        "카페", "식당", "횟집", "국수", "칼국수", "해수욕장", "교회",
        "시장", "공원", "박물관", "미술관", "거리", "전망대",
    )
    for name in names:
        s = (name or "").strip()
        if not s:
            continue
        _push(s)
        _push(re.sub(r"\s+", "", s))
        for sx in suffixes:
            if s.endswith(sx) and len(s) > len(sx) + 1:
                _push(f"{s[:-len(sx)].strip()} {sx}")
                break
    return out


async def _geocode_item(
    item: dict[str, Any],
    location_name: str = "",
) -> dict[str, Any]:
    """장소 좌표·주소를 카카오/네이버 API로 보강한다."""
    place = (item.get("place") or "").strip()
    place_ko = (item.get("place_ko") or "").strip()
    address = (item.get("address") or "").strip()
    region = (location_name or "").strip()
    search_name = place_ko or place
    kakao_queries = _build_geocode_query_variants(search_name, place, place_ko)

    for q in kakao_queries:
        kakao_region = _region_prefix_for_place_query(region, q)
        kr = await kakao_keyword_search_with_fallback(q, region=kakao_region)
        if not kr and kakao_region:
            kr = await kakao_keyword_search_with_fallback(q, region="")
        if kr:
            lat, lng = float(kr["y"]), float(kr["x"])
            logger.info(
                "카카오 검색 성공: region=%r q=%r → (%.5f, %.5f) [%s]",
                kakao_region or "(none)",
                q,
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

    naver_queries: list[str] = []
    if address:
        naver_queries.append(address)
    for q in _build_geocode_query_variants(place_ko, place):
        naver_queries.append(q)
        if region and region not in q:
            naver_queries.append(f"{region} {q}")
    for q in naver_queries:
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
_TIME_WORDS_KO = [["오전", "아침"], ["점심", "런치"], ["오후"], ["저녁", "디너", "야식"]]
_TIME_WORDS_EN = [["morning", "breakfast"], ["lunch", "midday"], ["afternoon"], ["evening", "dinner", "supper"]]
_MAX_CLUSTER_KM = 8.0


def _schedule_slot_text_lower(item: dict[str, Any]) -> str:
    return (
        f"{item.get('title', '')} {(item.get('description') or '')} {item.get('tips', '')}"
    ).lower()


def _slot_lexicon_time_mismatch_warnings(item: dict[str, Any], lang: str) -> list[str]:
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
    warnings: list[str] = []
    time_slot_map = _TIME_SLOT_KO if lang == "Korean" else _TIME_SLOT_EN
    time_words = _TIME_WORDS_KO if lang == "Korean" else _TIME_WORDS_EN
    meal_kw = _MEAL_KEYWORDS_KO if lang == "Korean" else _MEAL_KEYWORDS_EN

    def _is_meal(item: dict) -> bool:
        text = f"{item.get('place','')} {item.get('title','')} {item.get('description','')}".lower()
        return any(k in text for k in meal_kw)

    for i in range(len(items) - 1):
        if _is_meal(items[i]) and _is_meal(items[i + 1]):
            warnings.append(
                f"[연속식사] {items[i].get('time')}→{items[i+1].get('time')}: "
                f"'{items[i].get('place')}' 다음 '{items[i+1].get('place')}'"
            )

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

    geocoded = list(await asyncio.gather(*[
        _geocode_item(item, loc)
        for item in schedule
    ]))

    failed = [item for item in geocoded if item.get("geocode_failed")]
    if failed:
        logger.info("지오코딩 실패 %d/%d건 → 대체 장소 요청", len(failed), len(geocoded))
        fixed = await _fix_failed_places(failed, loc, lang)
        fixed_map = {id(orig): repl for orig, repl in zip(failed, fixed)}
        geocoded = [fixed_map.get(id(item), item) if item.get("geocode_failed") else item for item in geocoded]

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

