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
    # 한국어 국적명 (DB 저장값)
    "한국": "Korean",
    "미국": "English", "영국": "English", "호주": "English",
    "캐나다": "English", "싱가포르": "English", "인도": "English",
    "말레이시아": "English", "필리핀": "English", "인도네시아": "English",
    "태국": "English", "기타": "English",
    "일본": "Japanese",
    "중국": "Chinese (Simplified)",
    "독일": "German",
    "프랑스": "French",
    "베트남": "Vietnamese",
    # 영어 국적명 (하위 호환)
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

# 표준 플래너: 메인 싱글턴 모델 (환경변수 GEMINI_MODEL 미설정 시)
_STANDARD_PLANNER_PRIMARY_MODEL = "gemini-3-flash-preview"
# 메인 404/503·타임아웃 소진 후 시도 (싱글턴은 _llm_for_model 캐시)
_GEMINI_FALLBACK_MODELS: tuple[str, ...] = ("gemini-2.5-flash-lite",)
_llm_by_model: dict[str, ChatGoogleGenerativeAI] = {}


def _standard_planner_gemini_model() -> str:
    """메인 LLM 모델명. `settings.gemini_model`이 비어 있으면 3-flash-preview."""
    m = (settings.gemini_model or "").strip()
    return m or _STANDARD_PLANNER_PRIMARY_MODEL

# 단일 LLM 호출 타임아웃 – 다일차 JSON·검색 도구 응답은 수 분 걸릴 수 있음 (게이트웨이 900s 이내)
_INVOKE_TIMEOUT_SEC = 360.0
_503_RETRY_WAIT_SEC = 3.0
_503_MAX_RETRIES = 3
_UNAVAILABLE_MARKERS = ("503", "UNAVAILABLE", "high demand", "Service Unavailable")

_TIME_SLOTS_KO = ["오전", "점심", "오후", "저녁"]
_TIME_SLOTS_EN = ["morning", "lunch", "afternoon", "evening"]
_TIME_SLOT_RANK_KO = {s: i for i, s in enumerate(_TIME_SLOTS_KO)}
_TIME_SLOT_RANK_EN = {s: i for i, s in enumerate(_TIME_SLOTS_EN)}


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
    """일차 내 항목 순서: **LLM이 부여한 time 슬롯을 유지**하고 오전→점심→오후→저녁 순으로만 정렬한다.

    과거 구현은 최근접 이웃(NN) 순으로 재배열한 뒤 time을 덮어써, 점심 문구가 저녁 슬롯에 붙는 등
    심각한 모순이 났다.
    """
    if len(items) <= 1:
        return items

    def _rank(it: dict[str, Any]) -> int:
        t = str(it.get("time") or "").strip().lower()
        if t in _TIME_SLOT_RANK_KO:
            return _TIME_SLOT_RANK_KO[t]
        if t in _TIME_SLOT_RANK_EN:
            return _TIME_SLOT_RANK_EN[t]
        return 99

    return sorted(items, key=_rank)


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
            model=_standard_planner_gemini_model(),
            temperature=0.2,  # 낮을수록 실존 장소명 hallucination 감소
            google_api_key=settings.gemini_api_key,
            max_retries=0,  # SDK 내부 재시도 비활성화 → 503 즉시 예외 → 우리 재시도 로직 사용
        )
    return _llm_instance


def _get_llm_with_search():
    global _llm_search_instance
    if _llm_search_instance is None:
        base = ChatGoogleGenerativeAI(
            model=_standard_planner_gemini_model(),
            temperature=0.2,
            google_api_key=settings.gemini_api_key,
            max_retries=0,
        )
        _llm_search_instance = base.bind_tools([{"google_search": {}}])
    return _llm_search_instance


def _get_llm_search_context():
    """선행 웹 검색 전용 LLM 싱글턴.

    토큰 제한 없이 모델이 수집한 정보를 최대한 활용한다.
    폴백(2.5-flash) 시 정보량이 품질 차이를 보완하므로 제한을 두지 않는다.
    """
    global _llm_search_ctx_instance
    if _llm_search_ctx_instance is None:
        base = ChatGoogleGenerativeAI(
            model=_standard_planner_gemini_model(),
            temperature=0.2,
            google_api_key=settings.gemini_api_key,
            max_retries=0,
        )
        _llm_search_ctx_instance = base.bind_tools([{"google_search": {}}])
    return _llm_search_ctx_instance


def _llm_for_model(model_name: str, *, temperature: float = 0.2) -> ChatGoogleGenerativeAI:
    """모델명별 싱글턴 (폴백 체인용)."""
    key = f"{model_name}:{temperature}"
    if key not in _llm_by_model:
        _llm_by_model[key] = ChatGoogleGenerativeAI(
            model=model_name,
            temperature=temperature,
            google_api_key=settings.gemini_api_key,
            max_retries=0,
        )
    return _llm_by_model[key]


def _fallback_model_order() -> list[str]:
    """메인과 동일한 이름은 제외해 중복 호출을 피한다."""
    primary = _standard_planner_gemini_model()
    return [m for m in _GEMINI_FALLBACK_MODELS if m != primary]


async def _ainvoke_fallback_chain(messages: list) -> Any:
    """404/503·타임아웃 소진 후 폴백 모델 체인을 순서대로 시도.

    - 404: 즉시 다음 모델로
    - 503/timeout: 해당 모델을 _503_MAX_RETRIES 회 재시도 후 다음 모델로
    """
    names = _fallback_model_order()
    if not names:
        raise RuntimeError("폴백 모델 후보가 없습니다 (메인과 동일).")
    last_err: Exception | None = None
    for model_name in names:
        logger.warning("Gemini 폴백 시도: %s", model_name)
        unavail_count = 0
        while True:
            try:
                return await asyncio.wait_for(
                    _llm_for_model(model_name).ainvoke(messages),
                    timeout=_INVOKE_TIMEOUT_SEC,
                )
            except asyncio.TimeoutError as e:
                last_err = e
                if unavail_count < _503_MAX_RETRIES:
                    unavail_count += 1
                    logger.warning("폴백 %s 타임아웃 – %d초 후 재시도 (%d/%d)",
                                   model_name, _503_RETRY_WAIT_SEC, unavail_count, _503_MAX_RETRIES)
                    await asyncio.sleep(_503_RETRY_WAIT_SEC)
                    continue
                logger.warning("폴백 %s 타임아웃 재시도 소진 — 다음 후보", model_name)
                break
            except Exception as e:
                last_err = e
                msg = str(e)
                if "NOT_FOUND" in msg:
                    logger.warning("폴백 %s 404 — 다음 후보", model_name)
                    break
                if any(m in msg for m in _UNAVAILABLE_MARKERS):
                    if unavail_count < _503_MAX_RETRIES:
                        unavail_count += 1
                        logger.warning("폴백 %s 503 – %d초 후 재시도 (%d/%d)",
                                       model_name, _503_RETRY_WAIT_SEC, unavail_count, _503_MAX_RETRIES)
                        await asyncio.sleep(_503_RETRY_WAIT_SEC)
                        continue
                    logger.warning("폴백 %s 503 재시도 소진 — 다음 후보", model_name)
                    break
                raise
    if last_err:
        logger.error("폴백 체인 전체 실패: %s", last_err)
        raise last_err
    raise RuntimeError("Gemini 폴백 체인 실패")


def _is_daily_quota(err: Exception) -> bool:
    msg = str(err)
    return any(marker in msg for marker in _DAILY_QUOTA_MARKERS)


async def _invoke(
    llm: Any,
    messages: list,
    *,
    max_retries: int = 1,
    plain_fallback: bool = False,
    max_503_retries: int | None = None,
) -> Any:
    try:
        await asyncio.wait_for(_GEMINI_SEMAPHORE.acquire(), timeout=_SEMAPHORE_WAIT_TIMEOUT)
    except asyncio.TimeoutError:
        raise Exception(
            f"AI 서버가 바쁩니다 (대기 {_SEMAPHORE_WAIT_TIMEOUT}초 초과). "
            "잠시 후 다시 시도해 주세요."
        )
    try:
        return await _invoke_inner(
            llm, messages,
            max_retries=max_retries,
            plain_fallback=plain_fallback,
            max_503_retries=max_503_retries if max_503_retries is not None else _503_MAX_RETRIES,
        )
    finally:
        _GEMINI_SEMAPHORE.release()


async def _invoke_inner(
    llm: Any,
    messages: list,
    *,
    max_retries: int,
    plain_fallback: bool,
    max_503_retries: int = _503_MAX_RETRIES,
) -> Any:
    """503/타임아웃 재시도는 max_503_retries로, 429 재시도는 max_retries로 독립 관리."""
    unavailable_count = 0  # 503 / timeout 전용 카운터
    rate_limit_attempt = 0  # 429 전용 카운터

    while True:
        try:
            return await asyncio.wait_for(
                llm.ainvoke(messages),
                timeout=_INVOKE_TIMEOUT_SEC,
            )
        except asyncio.TimeoutError:
            if unavailable_count < max_503_retries:
                unavailable_count += 1
                logger.warning(
                    "Gemini 응답 타임아웃(%.0fs) – %d초 후 재시도 (%d/%d)",
                    _INVOKE_TIMEOUT_SEC, _503_RETRY_WAIT_SEC,
                    unavailable_count, max_503_retries,
                )
                await asyncio.sleep(_503_RETRY_WAIT_SEC)
                continue
            logger.warning("Gemini 타임아웃 재시도(%d) 소진 → 폴백 체인", max_503_retries)
            return await _ainvoke_fallback_chain(messages)
        except Exception as e:
            msg = str(e)

            if "grounding" in msg.lower() or "google_search" in msg.lower():
                logger.warning("Google Search grounding 미지원 – 일반 LLM으로 즉시 폴백")
                return await _get_llm().ainvoke(messages)

            if _is_daily_quota(e):
                raise

            # 404 NOT_FOUND: 재시도 무의미 → 즉시 fallback
            if "NOT_FOUND" in msg:
                logger.warning("Gemini 404 NOT_FOUND → 폴백 체인 (%s)", ", ".join(_GEMINI_FALLBACK_MODELS))
                try:
                    return await _ainvoke_fallback_chain(messages)
                except Exception as fb_err:
                    logger.error("폴백 체인 실패: %s", fb_err)
                    raise

            # 503 UNAVAILABLE: 독립 카운터로 재시도 후 소진 시 fallback
            if any(m in msg for m in _UNAVAILABLE_MARKERS):
                if unavailable_count < max_503_retries:
                    unavailable_count += 1
                    logger.warning(
                        "Gemini 503/NOT_FOUND – %d초 후 재시도 (%d/%d)",
                        _503_RETRY_WAIT_SEC, unavailable_count, max_503_retries,
                    )
                    await asyncio.sleep(_503_RETRY_WAIT_SEC)
                    continue
                logger.warning("Gemini 503 재시도(%d) 소진 → 폴백 체인", max_503_retries)
                try:
                    return await _ainvoke_fallback_chain(messages)
                except Exception as fb_err:
                    logger.error("폴백 체인 실패: %s", fb_err)
                    raise

            if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                if plain_fallback:
                    logger.warning("Gemini grounding 429 → 일반 LLM 즉시 폴백 (재시도 없음)")
                    return await _get_llm().ainvoke(messages)
                if rate_limit_attempt < max_retries:
                    rate_limit_attempt += 1
                    base = 2 * (2 ** rate_limit_attempt)
                    wait = base + random.uniform(0, base * 0.5)
                    logger.warning(
                        "Gemini 429 일시 제한 – %.1f초 대기 후 재시도 (%d/%d)",
                        wait, rate_limit_attempt, max_retries,
                    )
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
        "- ⚠️ Do NOT output lat, lng, or address — they are filled by Kakao/Naver after save (same as itinerary generation).\n"
        "- Include place_ko (Korean official name) for every changed item for geocoding.\n"
        "- If the requested place/event/movie does NOT exist or is NOT available (e.g. not currently screening, closed, fictional), "
        "  keep the schedule UNCHANGED and set 'not_possible' to true with a brief reason in 'reason' (1-2 sentences).\n"
        "- If the request IS fulfilled, set 'not_possible' to false and explain briefly WHY this change is good in 'reason' (1-2 sentences).\n"
        f"{lang_dir}"
        "\nRespond ONLY with valid JSON (no explanation):\n"
        '{"not_possible":false,"reason":"brief explanation here",'
        '"schedule":[{"day":1,"date":"YYYY-MM-DD","time":"morning","place":"place name","place_ko":"한국어 상호",'
        '"title":"activity title","description":"description","tips":"tip"}],'
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
        "⚠️ Do NOT output lat, lng, or address — Kakao/Naver geocoding runs after this response.\n"
    )

    if lang == "Korean":
        place_rules = (
            "- place·place_ko: 네이버/카카오맵에서 검색 가능한 실제 상호명만 (place_ko는 한국어 상호).\n"
        )
        schema_example = (
            f'{{"day":{day},"date":"{date_str}","time":"{time_str}",'
            '"place":"장소명","place_ko":"한국어 상호",'
            '"title":"활동명","description":"설명","tips":"팁","estimated_cost":"₩0"}'
        )
    else:
        place_rules = (
            f"- place: real name in {lang}; place_ko: Korean name for geocoding (required).\n"
        )
        schema_example = (
            f'{{"day":{day},"date":"{date_str}","time":"{time_str}",'
            f'"place":"name in {lang}","place_ko":"한국어 상호",'
            '"title":"activity title","description":"description","tips":"tip","estimated_cost":"₩0"}'
        )

    prompt += place_rules + f"{lang_dir}\nRespond ONLY with valid JSON (no explanation):\n{schema_example}\n"
    llm = _get_llm_with_search()
    response = await _invoke(llm, [HumanMessage(content=prompt)])
    return _parse_json(response)
