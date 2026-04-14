"""Day-generation prompt and duplicate-fix helpers for standard planner."""
import logging
import re
from time import perf_counter
from typing import Any, TypedDict

from langchain_core.messages import HumanMessage

from app.agent.standard.nodes_common import _get_llm, _invoke, _parse_json

logger = logging.getLogger(__name__)


def _normalize_place_key(name: str) -> str:
    s = (name or "").strip().lower()
    if not s:
        return ""
    s = re.sub(r"\([^)]*\)", "", s)
    s = re.sub(r"[\[\]{}<>]", " ", s)
    s = re.sub(r"[^0-9a-zA-Z가-힣]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(
        r"\b(본점|본관|별관|신관|구관|본사|점|branch|main|store|the|cafe|restaurant|hotel|resort)\b",
        "",
        s,
    )
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _strip_region_from_key(k: str, region: str) -> str:
    kk = (k or "").strip()
    rr = _normalize_place_key(region)
    if not kk or not rr:
        return kk
    kk = kk.replace(rr, " ")
    kk = re.sub(r"\s+", " ", kk).strip()
    return kk


def _strip_venue_suffixes(k: str, lang: str) -> str:
    s = (k or "").strip()
    if not s:
        return ""
    if lang == "Korean":
        s = re.sub(r"(케이블카|곤돌라|리프트|스카이웨이|로프웨이)$", "", s)
    else:
        s = re.sub(r"(cable ?car|gondola|lift|skyway|ropeway)$", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _venue_dedupe_key(item: dict[str, Any], *, region: str, lang: str) -> str:
    p_ko = _normalize_place_key(str(item.get("place_ko") or ""))
    p = _normalize_place_key(str(item.get("place") or ""))
    cands = [x for x in [p_ko, p] if x]
    if not cands:
        return ""
    best = min(cands, key=len)
    best = _strip_region_from_key(best, region)
    best = _strip_venue_suffixes(best, lang)
    return best or min(cands, key=len)


def _item_text_blob(item: dict[str, Any]) -> str:
    return f"{item.get('place','')} {item.get('title','')} {item.get('description','')} {item.get('tips','')}".lower()


def _experience_tags_from_blob(blob: str, lang: str) -> set[str]:
    tags: set[str] = set()
    b = (blob or "").lower()
    if any(x in b for x in ("케이블카", "곤돌라", "리프트", "ropeway", "cable car", "gondola", "lift")):
        tags.add("rope_transport")
    if any(x in b for x in ("사찰", "템플", "절", "temple", "buddhist")):
        tags.add("temple")
    if any(x in b for x in ("교회", "성당", "cathedral", "church", "chapel")):
        tags.add("church")
    if any(x in b for x in ("박물관", "미술관", "museum", "gallery")):
        tags.add("museum")
    return tags


def _experience_tags_for_items(items: list[dict[str, Any]], lang: str) -> set[str]:
    tags: set[str] = set()
    for it in items:
        tags |= _experience_tags_from_blob(_item_text_blob(it), lang)
    return tags


def _banned_experience_block(used_tags: set[str], lang: str) -> str:
    if "rope_transport" not in used_tags:
        return ""
    if lang == "Korean":
        return (
            "【중복 체험 금지】\n"
            "- 이미 다른 날 케이블카/곤돌라/리프트 체험이 포함되었습니다.\n"
            "- 이번 일차에서는 케이블카/곤돌라/리프트/로프웨이 관련 장소를 절대 포함하지 마세요.\n"
            "- 대체로 산책, 지상 전망 포인트, 박물관, 시장, 카페 등으로 구성하세요.\n"
        )
    return (
        "【No duplicate experience】\n"
        "- A cable-car/gondola/lift experience was already used on another day.\n"
        "- Do NOT include any cable-car/gondola/lift/ropeway venue in this day.\n"
        "- Use walks, ground viewpoints, museums, markets, spas, cafés instead.\n"
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
    web_search_block: str
    poi_context_block: str
    naver_tips_block: str


def _extract_kakao_poi_names(poi_context_block: str, *, limit: int = 60) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in (poi_context_block or "").splitlines():
        line = raw.strip()
        if not line or "•" not in line:
            continue
        txt = line.split("•", 1)[1].strip()
        txt = re.sub(r"^\[[^\]]+\]\s*", "", txt)
        txt = re.sub(r"^\([^)]*\)\s*", "", txt)
        txt = txt.split(" – ", 1)[0].strip()
        if not txt or len(txt) < 2:
            continue
        key = txt.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(txt)
        if len(out) >= limit:
            break
    return out


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

    poi_allow_names = _extract_kakao_poi_names(poi_context_block)
    if lang == "Korean":
        if poi_allow_names:
            allow_block = (
                "【출처 강제 규칙 (카카오/네이버 기반)】\n"
                "- place/place_ko는 아래 카카오 POI 후보 목록의 **실제 상호명**을 우선 사용하세요.\n"
                "- 네이버 팁은 테마/동선/팁 참고용이며, 장소명은 카카오 후보와 일치하는 실명으로 맞추세요.\n"
                "- 후보 외 장소를 쓰면 반드시 같은 생활권에서 카카오 검색 가능한 실명이어야 하며, 불확실하면 후보 목록에서 대체하세요.\n"
                f"- 카카오 후보(우선 선택): {', '.join(poi_allow_names[:40])}\n"
            )
        else:
            allow_block = (
                "【출처 강제 규칙 (카카오/네이버 기반)】\n"
                "- 카카오 후보가 비어 있을 때만 네이버 팁/컨텍스트 기반으로 실존 장소를 선택하세요.\n"
                "- place/place_ko는 반드시 카카오/네이버 검색 가능한 실명 상호로 작성하세요.\n"
            )
    else:
        if poi_allow_names:
            allow_block = (
                "【Source-constrained rule (Kakao/Naver)】\n"
                "- Use real place names from the Kakao POI candidate list first for place/place_ko.\n"
                "- Naver tips are for themes/ordering only; align names to Kakao-searchable real venues.\n"
                "- If you must use a place not in the list, it must still be a verifiable real venue in the same area.\n"
                f"- Kakao candidates (prefer): {', '.join(poi_allow_names[:40])}\n"
            )
        else:
            allow_block = (
                "【Source-constrained rule (Kakao/Naver)】\n"
                "- If Kakao candidates are unavailable, choose only verifiable real venues from Naver/context.\n"
                "- place/place_ko must be map-searchable exact real names.\n"
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
        f"{allow_block}"
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

