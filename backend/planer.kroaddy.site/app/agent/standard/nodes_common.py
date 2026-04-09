"""Standard planner shared node helpers."""
import asyncio
import json
import logging
import random
import re
from math import atan2, cos, radians, sin, sqrt
from typing import Any

from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI  # pyright: ignore[reportMissingImports]

from app.core.config import settings
from app.services.search_client import (
    fetch_boxoffice,
    format_boxoffice_context,
    is_movie_query,
)

logger = logging.getLogger(__name__)

# Nationality -> response language mapping
_NATIONALITY_TO_LANG: dict[str, str] = {
    "한국": "Korean",
    "USA": "English", "United Kingdom": "English", "Australia": "English",
    "Canada": "English", "Singapore": "English", "India": "English",
    "Malaysia": "English", "Philippines": "English", "Indonesia": "English",
    "Thailand": "English", "Other": "English",
    "日本": "Japanese",
    "中国": "Chinese (Simplified)",
    "Deutschland": "German",
    "France": "French",
    "Việt Nam": "Vietnamese",
}

_DAILY_QUOTA_MARKERS = (
    "GenerateRequestsPerDayPerProjectPerModel",
    "You exceeded your current quota",
    "check your plan and billing details",
)

_GEMINI_SEMAPHORE = asyncio.Semaphore(20)
_SEMAPHORE_WAIT_TIMEOUT = 10

_llm_instance: "ChatGoogleGenerativeAI | None" = None
_llm_search_instance: "ChatGoogleGenerativeAI | None" = None
_llm_search_ctx_instance: "ChatGoogleGenerativeAI | None" = None
# 503 UNAVAILABLE 시 즉시 대체할 안정적인 stable 모델
_llm_fallback_instance: "ChatGoogleGenerativeAI | None" = None

# 단일 LLM 호출 타임아웃 – SDK 내부 재시도가 수분씩 대기하는 것을 방지
_INVOKE_TIMEOUT_SEC = 25.0
_UNAVAILABLE_MARKERS = ("503", "UNAVAILABLE", "high demand", "Service Unavailable")

_TIME_SLOTS_KO = ["오전", "점심", "오후", "저녁"]
_TIME_SLOTS_EN = ["morning", "lunch", "afternoon", "evening"]


def _get_lang(profile: dict | None) -> str:
    if not profile:
        return "Korean"
    return _NATIONALITY_TO_LANG.get(profile.get("nationality") or "", "Korean")


def _lang_directive(lang: str) -> str:
    if lang == "Korean":
        return (
            "\n⚠️ 중요(CRITICAL): name, description, highlights 등 "
            "모든 텍스트 값을 반드시 한국어로 작성하세요. "
            "장소명은 절대 로마자(예: 'gwangalli') 사용 금지. JSON 키는 영어 유지.\n"
        )
    return (
        f"\n⚠️ IMPORTANT: Write ALL text values (name, description, highlights, etc.) "
        f"ENTIRELY in {lang}. NEVER use Korean characters. JSON keys must stay in English.\n"
    )


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def _optimize_day_order(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    has_coords = [it for it in items if it.get("lat") and it.get("lng")]
    no_coords = [it for it in items if not (it.get("lat") and it.get("lng"))]
    if len(has_coords) <= 1:
        return items

    sample_time = items[0].get("time", "오전") if items else "오전"
    time_slots = _TIME_SLOTS_KO if sample_time in _TIME_SLOTS_KO else _TIME_SLOTS_EN

    remaining = list(has_coords)
    ordered = [remaining.pop(0)]
    while remaining:
        last = ordered[-1]
        nearest_idx = min(
            range(len(remaining)),
            key=lambda i: _haversine_km(
                last.get("lat", 0), last.get("lng", 0),
                remaining[i].get("lat", 0), remaining[i].get("lng", 0),
            ),
        )
        ordered.append(remaining.pop(nearest_idx))

    for i, item in enumerate(ordered):
        ordered[i] = {**item, "time": time_slots[i] if i < len(time_slots) else item.get("time", "")}
    return ordered + no_coords


def _total_route_km(items: list[dict[str, Any]]) -> float:
    total = 0.0
    for i in range(len(items) - 1):
        a, b = items[i], items[i + 1]
        if a.get("lat") and a.get("lng") and b.get("lat") and b.get("lng"):
            total += _haversine_km(a["lat"], a["lng"], b["lat"], b["lng"])
    return total


def _get_llm() -> ChatGoogleGenerativeAI:
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            temperature=0.4,
            google_api_key=settings.gemini_api_key,
        )
    return _llm_instance


def _get_llm_with_search():
    global _llm_search_instance
    if _llm_search_instance is None:
        base = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            temperature=0.4,
            google_api_key=settings.gemini_api_key,
        )
        _llm_search_instance = base.bind_tools([{"google_search": {}}])
    return _llm_search_instance


def _get_llm_search_context():
    """선행 웹 검색 전용 LLM 싱글턴.

    메인 LLM과 동일한 모델이지만 max_output_tokens=600으로 응답 길이를 제한한다.
    GoogleSearchAPIWrapper(k=5)가 LLM 입력 토큰을 줄이는 것과 같은 맥락으로,
    여기서는 **출력 토큰** 상한을 걸어 생성 시간 자체를 단축한다.
    JSON이 아닌 불릿 텍스트를 받으므로 max_output_tokens 사용이 안전하다.
    """
    global _llm_search_ctx_instance
    if _llm_search_ctx_instance is None:
        base = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            temperature=0.2,          # 낮은 temperature → 군더더기 없는 사실 나열
            max_output_tokens=600,    # 검색 요약은 짧을수록 빠름
            google_api_key=settings.gemini_api_key,
        )
        _llm_search_ctx_instance = base.bind_tools([{"google_search": {}}])
    return _llm_search_ctx_instance


def _get_llm_fallback() -> ChatGoogleGenerativeAI:
    """503 UNAVAILABLE / 타임아웃 시 즉시 대체할 경량 fallback 모델.

    메인 모델(gemini-3-flash)이 과부하일 때 SDK가 수분간 재시도하는 것을 방지한다.
    gemini-2.0-flash-lite는 더 가볍고 빠른 GA 모델이다.
    """
    global _llm_fallback_instance
    if _llm_fallback_instance is None:
        _llm_fallback_instance = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-lite",
            temperature=0.4,
            google_api_key=settings.gemini_api_key,
        )
    return _llm_fallback_instance


def _is_daily_quota(err: Exception) -> bool:
    msg = str(err)
    return any(marker in msg for marker in _DAILY_QUOTA_MARKERS)


async def _invoke(llm: Any, messages: list, *, max_retries: int = 1, plain_fallback: bool = False) -> Any:
    try:
        await asyncio.wait_for(_GEMINI_SEMAPHORE.acquire(), timeout=_SEMAPHORE_WAIT_TIMEOUT)
    except asyncio.TimeoutError:
        raise Exception(
            f"AI 서버가 바쁩니다 (대기 {_SEMAPHORE_WAIT_TIMEOUT}초 초과). "
            "잠시 후 다시 시도해 주세요."
        )
    try:
        return await _invoke_inner(llm, messages, max_retries=max_retries, plain_fallback=plain_fallback)
    finally:
        _GEMINI_SEMAPHORE.release()


async def _invoke_inner(llm: Any, messages: list, *, max_retries: int, plain_fallback: bool) -> Any:
    for attempt in range(max_retries + 1):
        try:
            # SDK 내부 재시도가 수분씩 블로킹하는 것을 방지하기 위해 타임아웃을 건다.
            return await asyncio.wait_for(
                llm.ainvoke(messages),
                timeout=_INVOKE_TIMEOUT_SEC,
            )
        except asyncio.TimeoutError:
            logger.warning(
                "Gemini 응답 타임아웃(%.0fs) – stable 모델로 즉시 폴백 (시도 %d/%d)",
                _INVOKE_TIMEOUT_SEC, attempt + 1, max_retries + 1,
            )
            return await asyncio.wait_for(
                _get_llm_fallback().ainvoke(messages),
                timeout=_INVOKE_TIMEOUT_SEC,
            )
        except Exception as e:
            msg = str(e)

            if "grounding" in msg.lower() or "google_search" in msg.lower():
                logger.warning("Google Search grounding 미지원 – 일반 LLM으로 즉시 폴백")
                return await _get_llm().ainvoke(messages)

            if _is_daily_quota(e):
                raise

            # 503 UNAVAILABLE: SDK가 내부적으로 긴 재시도를 하므로 즉시 stable 모델로 전환
            if any(m in msg for m in _UNAVAILABLE_MARKERS):
                logger.warning("Gemini 503 UNAVAILABLE → fallback 모델(gemini-2.0-flash-lite)로 즉시 폴백")
                try:
                    return await asyncio.wait_for(
                        _get_llm_fallback().ainvoke(messages),
                        timeout=_INVOKE_TIMEOUT_SEC,
                    )
                except Exception as fb_err:
                    logger.error("Fallback 모델도 실패: %s", fb_err)
                    raise

            if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                if plain_fallback:
                    logger.warning("Gemini grounding 429 → 일반 LLM 즉시 폴백 (재시도 없음)")
                    return await _get_llm().ainvoke(messages)
                if attempt < max_retries:
                    base = 2 * (2 ** attempt)
                    wait = base + random.uniform(0, base * 0.5)
                    logger.warning("Gemini 429 일시 제한 – %.1f초 대기 후 재시도 (%d/%d)", wait, attempt + 1, max_retries)
                    await asyncio.sleep(wait)
                    continue
            raise


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                parts.append(part.get("text", ""))
        return "".join(parts)
    return str(content)


def _extract_text_from_response(response: Any) -> str:
    blocks = getattr(response, "content_blocks", None)
    if blocks:
        parts = []
        for block in blocks:
            if isinstance(block, dict) and block.get("type", "") == "text":
                parts.append(block.get("text", ""))
        text = "".join(parts).strip()
        if text:
            return text
    return _extract_text(response.content)


def _parse_json(raw: Any) -> dict:
    if hasattr(raw, "content") or hasattr(raw, "content_blocks"):
        text = _extract_text_from_response(raw).strip()
    else:
        text = _extract_text(raw).strip()
    if not text:
        logger.error("LLM 응답 본문이 비어 있습니다. raw type=%s, value=%r", type(raw), raw)
        raise ValueError("LLM 응답이 비어 있습니다. 모델이 JSON을 반환하지 않았습니다.")
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text.strip())


def _format_festival_date(d: str) -> str:
    if len(d) == 8 and d.isdigit():
        return f"{d[:4]}-{d[4:6]}-{d[6:]}"
    return d


def _build_user_profile_block(profile: dict | None, lang: str = "Korean") -> str:
    if not profile:
        return ""
    gender = profile.get("gender") or ""
    age_band = profile.get("age_band") or ""
    dietary = profile.get("dietary_pref") or ""
    religion = profile.get("religion") or ""
    nationality = profile.get("nationality") or ""
    is_korean = lang == "Korean"

    if is_korean:
        header = "【여행자 프로필 (루트·일정 개인화에 반드시 반영)】"
        fields = []
        if nationality:
            fields.append(f"  • 국적: {nationality}")
        if gender:
            fields.append(f"  • 성별: {gender}")
        if age_band:
            fields.append(f"  • 나이대: {age_band}")
        if dietary:
            fields.append(f"  • 식습관: {dietary}")
        if religion:
            fields.append(f"  • 종교: {religion}")
    else:
        header = "【Traveler Profile (MUST be reflected in routes and itinerary)】"
        fields = []
        if nationality:
            fields.append(f"  • Nationality: {nationality}")
        if gender:
            fields.append(f"  • Gender: {gender}")
        if age_band:
            fields.append(f"  • Age group: {age_band}")
        if dietary:
            fields.append(f"  • Diet: {dietary}")
        if religion:
            fields.append(f"  • Religion: {religion}")

    if not fields:
        return ""
    lines = [header] + fields + [""]
    notes: list[str] = []

    if dietary in ("채식", "Vegetarian"):
        notes.append("- 식사 장소는 채식 메뉴가 있는 곳 우선 선택." if is_korean else "- Prioritize restaurants with vegetarian menu options.")
    elif dietary in ("비건", "Vegan"):
        notes.append("- 식사 장소는 완전 비건 식당 또는 비건 옵션 명확한 곳만 선택." if is_korean else "- Only include fully vegan restaurants or venues with clear vegan options.")
    elif dietary in ("할랄", "Halal"):
        notes.append("- 식사 장소는 할랄 인증 또는 무슬림 친화 식당만 선택. 돼지고기·주류 제공 업소 제외." if is_korean else "- Only include halal-certified or Muslim-friendly restaurants. Exclude pork/alcohol venues.")
    elif dietary in ("알레르기있음", "Allergy"):
        notes.append("- 식사 장소 tips 필드에 주요 알레르기 유발 식재료 주의 안내 포함." if is_korean else "- Include allergy warnings (common allergens) in tips for food-related schedule items.")

    if religion in ("이슬람", "Muslim"):
        notes.append("- 할랄 식당·이슬람 문화 시설 우선. 주류·돼지고기 취급 장소 배제." if is_korean else "- Prioritize halal restaurants and Islamic cultural sites. Avoid alcohol/pork venues.")
    elif religion in ("불교", "Buddhist"):
        notes.append("- 명소 루트에 불교 사찰·템플스테이·문화 체험 포함 권장." if is_korean else "- Include Buddhist temples, cultural sites, or temple-stay experiences in sightseeing routes.")
    elif religion in ("기독교", "Christian"):
        notes.append("- 명소 루트에 교회·기독교 역사 유적지 포함 권장." if is_korean else "- Include churches or Christian heritage sites in sightseeing routes.")
    elif religion in ("천주교", "Catholic"):
        notes.append("- 명소 루트에 성당·천주교 성지 포함 권장." if is_korean else "- Include cathedrals or Catholic pilgrimage sites in sightseeing routes.")

    if age_band in ("10대",):
        notes.append("- 저예산 명소·체험형 활동 중심. 이동 효율 높은 동선 구성." if is_korean else "- Focus on budget-friendly attractions and hands-on activities with efficient routing.")
    elif age_band in ("60대이상", "60대 이상"):
        notes.append("- 계단·오르막 최소화. 실내 관광지·편의시설 접근성 좋은 장소 우선. 이동 거리 짧게 구성." if is_korean else "- Minimize stairs/steep climbs. Prioritize indoor venues and accessible facilities. Keep distances short.")
    elif age_band in ("50대",):
        notes.append("- 과도한 도보 일정 지양. 여유로운 동선과 고품질 식사 장소 반영." if is_korean else "- Avoid excessive walking. Include relaxed pacing and quality dining options.")

    if gender in ("여성", "Female"):
        notes.append("- 야간 일정은 안전하고 유동인구가 많은 장소 우선. tips에 안전 팁 포함 권장." if is_korean else "- For evening items, prioritize safe and busy areas. Consider adding safety tips in the tips field.")

    if notes:
        lines.append("개인화 지침:" if is_korean else "Personalization notes:")
        lines.extend(notes)
        lines.append("")
    return "\n".join(lines) + "\n"


def _build_transport_block(transport_mode: str | None) -> str:
    if not transport_mode:
        return ""
    guides = {
        "car": (
            "【이동수단: 자가용】\n"
            "- 주차 가능한 장소 우선 선택하세요 (주차장 있는 명소·식당).\n"
            "- 하루 이동 반경을 넓게 설정해도 됩니다 (도시 외곽·드라이브 코스 포함 가능).\n"
            "- tips 필드에 주차 정보를 간단히 포함하세요.\n\n"
        ),
        "transit": (
            "【이동수단: 대중교통】\n"
            "- 지하철·버스 접근이 쉬운 장소만 선택하세요.\n"
            "- 하루 일정의 장소들은 반경 3km 이내에 밀집 배치하세요.\n"
            "- tips 필드에 주요 교통편(지하철역·버스 노선)을 안내하세요.\n\n"
        ),
        "walk": (
            "【이동수단: 도보】\n"
            "- 하루 일정의 모든 장소를 도보 이동 가능하도록 반경 2km 이내로 배치하세요.\n"
            "- 언덕·계단이 많은 장소는 최소화하세요.\n"
            "- tips 필드에 도보 소요 시간(분) 또는 도보 경로 힌트를 포함하세요.\n\n"
        ),
    }
    return guides.get(transport_mode, "")


async def modify_schedule(
    schedule: list[dict[str, Any]],
    instruction: str,
    location: str,
    user_profile: dict | None = None,
) -> dict[str, Any]:
    lang = _get_lang(user_profile)
    lang_dir = _lang_directive(lang)
    schedule_json = json.dumps(schedule, ensure_ascii=False, separators=(",", ":"))

    kobis_block = ""
    if is_movie_query(instruction):
        movies = await fetch_boxoffice()
        ctx = format_boxoffice_context(movies)
        if ctx:
            kobis_block = f"\n{ctx}\n"
            logger.info("KOBIS 박스오피스 컨텍스트 주입 (modify_schedule)")

    prompt = (
        f"Destination:{location}\n"
        f"⚠️ GEOGRAPHIC CONSTRAINT: ALL places must be within '{location}'. Never use places from other cities.\n"
        f'Modification instruction:"{instruction}"\n'
        f"{kobis_block}"
        f"Current schedule (JSON):\n{schedule_json}\n\n"
        "Rules:\n"
        "- Replace only the instructed items' place/title/description/tips\n"
        "- Never change day/date/time or other items\n"
        f"- Use only real existing places within {location}\n"
        "- For every item include: address (도로명 주소), lat, lng\n"
        "- If the requested place/event/movie does NOT exist or is NOT available (e.g. not currently screening, closed, fictional), "
        "  keep the schedule UNCHANGED and set 'not_possible' to true with a brief reason in 'reason' (1-2 sentences).\n"
        "- If the request IS fulfilled, set 'not_possible' to false and explain briefly WHY this change is good in 'reason' (1-2 sentences).\n"
        f"{lang_dir}"
        "\nRespond ONLY with valid JSON (no explanation):\n"
        '{"not_possible":false,"reason":"brief explanation here",'
        '"schedule":[{"day":1,"date":"YYYY-MM-DD","time":"morning","place":"place name","address":"도로명 주소","lat":37.5665,"lng":126.9780,"title":"activity title","description":"description","tips":"tip"}],'
        '"modified_titles":["title of modified item"]}'
    )
    llm = _get_llm_with_search()
    try:
        response = await _invoke(llm, [HumanMessage(content=prompt)])
        data = _parse_json(response)
        return {
            "schedule": data.get("schedule", schedule),
            "modified_titles": data.get("modified_titles", []),
            "not_possible": data.get("not_possible", False),
            "reason": data.get("reason", ""),
        }
    except Exception as e:
        logger.exception("일정 수정 실패: %s", e)
        return {"schedule": schedule, "modified_titles": [], "error": str(e)}


async def reroll_single_item(
    item: dict[str, Any],
    schedule: list[dict[str, Any]],
    location: str,
    user_profile: dict | None = None,
) -> dict[str, Any]:
    day = item.get("day", 1)
    date_str = item.get("date", "")
    time_str = item.get("time", "")
    lang = _get_lang(user_profile)
    lang_dir = _lang_directive(lang)
    same_day_titles = [
        s["title"] for s in schedule
        if s.get("day") == day and s.get("title") != item.get("title")
    ]
    same_day_ctx = f"Other items same day (no duplicates): {', '.join(same_day_titles)}" if same_day_titles else ""

    kobis_block = ""
    item_text = f"{item.get('title', '')} {item.get('place', '')}"
    if is_movie_query(item_text):
        movies = await fetch_boxoffice()
        ctx = format_boxoffice_context(movies)
        if ctx:
            kobis_block = f"\n{ctx}\n"
            logger.info("KOBIS 박스오피스 컨텍스트 주입 (reroll_single_item)")

    prompt = (
        f"Destination:{location} | Day{day}({date_str}) {time_str}\n"
        f"⚠️ GEOGRAPHIC CONSTRAINT: ALL places must be within '{location}'. Never use places from other cities.\n"
        f"Replace: {item.get('title')} (📍{item.get('place')})\n"
        f"{same_day_ctx}\n"
        f"{kobis_block}\n"
        f"Replace with a completely different place/activity within {location}. Keep day/date/time identical.\n"
        f"Use only real existing places within {location}.\n"
        "Include estimated_cost in KRW (e.g. '무료', '₩3,000', '₩15,000~₩20,000').\n"
        "Include address (도로명 주소), lat, lng for the new place.\n"
        f"{lang_dir}"
        "\nRespond ONLY with valid JSON (no explanation):\n"
        f'{{"day":{day},"date":"{date_str}","time":"{time_str}",'
        '"place":"place name","address":"도로명 주소","lat":37.5665,"lng":126.9780,'
        '"title":"activity title","description":"description","tips":"tip",'
        '"estimated_cost":"₩0"}'
        "}"
    )
    llm = _get_llm_with_search()
    response = await _invoke(llm, [HumanMessage(content=prompt)])
    return _parse_json(response)
