"""LangGraph 노드 – Gemini로 루트/일정 생성 및 수정."""
import asyncio
import json
import logging
import random
import re
from datetime import datetime, timedelta
from math import atan2, cos, radians, sin, sqrt
from typing import Any

from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.agent.standard.state import PlannerState
from app.core.config import settings
from app.services.naver_map_client import geocode
from app.services.naver_place_hours import enrich_schedule_items_with_hours
from app.services.news_client import build_news_block_for_prompt
from app.services.search_client import (
    fetch_boxoffice,
    format_boxoffice_context,
    is_movie_query,
)
from app.services.weather_client import build_weather_block_for_prompt

logger = logging.getLogger(__name__)

_TRAVEL_DAYS_DEFAULT = 2

# 국적 → Gemini 응답 언어 지시 매핑
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


def _get_lang(profile: dict | None) -> str:
    """사용자 국적에서 응답 언어를 결정한다. 기본값은 Korean."""
    if not profile:
        return "Korean"
    return _NATIONALITY_TO_LANG.get(profile.get("nationality") or "", "Korean")


def _lang_directive(lang: str) -> str:
    """Korean이 아닌 경우 Gemini에 언어 지시 문구를 반환한다."""
    if lang == "Korean":
        return ""
    return (
        f"\n⚠️ IMPORTANT: Write ALL text values (name, description, title, tips, highlights, etc.) "
        f"ENTIRELY in {lang}. JSON keys must stay in English.\n"
    )

# 일일 쿼터 초과 식별자 (재시도해도 무의미) — 여러 패턴 지원
_DAILY_QUOTA_MARKERS = (
    "GenerateRequestsPerDayPerProjectPerModel",  # 분당 제한 초과 후 일일 한도
    "You exceeded your current quota",           # 청구 계획 한도 초과
    "check your plan and billing details",       # 동일 맥락 추가 식별자
)

# 워커당 동시 Gemini 호출 최대 수 – 429 방지
# Gemini Tier1: 2000 RPM / 60s = 33 req/s
# 응답 평균 20s 가정 → 이론 최대 660 동시. 안전 마진 적용 → 워커당 20개
# uvicorn --workers 2 기준: 전체 최대 동시 호출 = 2 × 20 = 40개
# asyncio Semaphore는 non-blocking – 대기 요청은 이벤트 루프 차단 없이 yield됨
_GEMINI_SEMAPHORE = asyncio.Semaphore(20)
_SEMAPHORE_WAIT_TIMEOUT = 30  # 초 – 실제 서비스에서 30초 대기도 허용


# ──────────────────────────────────────────────────────────────────────────
# 경로 최적화 – Nearest Neighbor TSP (일별 장소 순서 최적화)
# ──────────────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 WGS84 좌표 사이의 직선거리(km)."""
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


# 시간 슬롯 순서 (한국어 / 영어)
_TIME_SLOTS_KO = ["오전", "점심", "오후", "저녁"]
_TIME_SLOTS_EN = ["morning", "lunch", "afternoon", "evening"]


def _optimize_day_order(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """하루 일정 내 장소를 Nearest Neighbor TSP로 최적 순서로 재배치한다.

    알고리즘:
    - 좌표가 있는 항목에 대해 Nearest Neighbor 휴리스틱 적용 (O(n²), 4개 이하로 충분)
    - 첫 번째 항목(오전/morning)을 출발점으로 고정하여 자연스러운 흐름 유지
    - 최적화 후 시간 슬롯을 순서대로 재배정 (오전→점심→오후→저녁)
    - 좌표 없는 항목은 마지막에 배치 (graceful degradation)

    효과:
    - 도시 한쪽에서 시작해 반대편 갔다가 다시 처음 근처로 돌아오는
      비효율적 이동 패턴 제거
    - 이동 거리 평균 30~50% 단축 (4 장소 기준 실험값)
    """
    has_coords = [it for it in items if it.get("lat") and it.get("lng")]
    no_coords  = [it for it in items if not (it.get("lat") and it.get("lng"))]

    if len(has_coords) <= 1:
        return items  # 최적화 불필요

    # 사용 중인 시간 슬롯 언어 감지 (Korean / English)
    sample_time = items[0].get("time", "오전") if items else "오전"
    time_slots = _TIME_SLOTS_KO if sample_time in _TIME_SLOTS_KO else _TIME_SLOTS_EN

    # Nearest Neighbor: 첫 항목을 고정 출발점으로 시작
    remaining = list(has_coords)
    ordered   = [remaining.pop(0)]

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

    # 시간 슬롯 재배정: 최적화된 순서에 따라 오전→점심→오후→저녁 매핑
    for i, item in enumerate(ordered):
        ordered[i] = {**item, "time": time_slots[i] if i < len(time_slots) else item.get("time", "")}

    return ordered + no_coords


def _total_route_km(items: list[dict[str, Any]]) -> float:
    """일정 항목들의 순서대로 총 이동 거리(km) 계산."""
    total = 0.0
    for i in range(len(items) - 1):
        a, b = items[i], items[i + 1]
        if a.get("lat") and a.get("lng") and b.get("lat") and b.get("lng"):
            total += _haversine_km(a["lat"], a["lng"], b["lat"], b["lng"])
    return total


def _get_llm() -> ChatGoogleGenerativeAI:
    """Gemini LLM 인스턴스 반환. max_output_tokens는 설정하지 않음.
    (langchain-google-genai 4.x에서 max_output_tokens 파라미터가
    실제보다 낮게 적용되어 JSON이 중간에 잘리는 버그가 있음)
    """
    return ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        temperature=0.4,
        google_api_key=settings.gemini_api_key,
    )


def _get_llm_with_search():
    """Google Search grounding이 활성화된 Gemini LLM.

    Gemini가 영화 상영 여부·신규 오픈·실시간 행사 등을 스스로 검색해
    정확한 정보를 바탕으로 일정을 생성·수정한다.
    fallback(OpenAI)은 grounding 미지원이므로 일반 LLM으로 대체한다.
    """
    llm = ChatGoogleGenerativeAI(
        model="gemini-3-flash-preview",
        temperature=0.4,
        google_api_key=settings.gemini_api_key,
    )
    return llm.bind_tools([{"google_search": {}}])


def _get_fallback_llm():
    """Gemini 일일 쿼터 초과 시 gpt-5-mini 폴백 LLM.

    gpt-5-mini는 reasoning 모델: temperature 미지원, max_completion_tokens 사용.
    토큰 제한 없이 모델 기본값 사용.
    """
    from langchain_openai import ChatOpenAI  # lazy import – Gemini 정상일 때 불필요
    return ChatOpenAI(
        model="gpt-5-mini",
        openai_api_key=settings.openai_api_key,
    )


def _is_daily_quota(err: Exception) -> bool:
    """Gemini 일일 쿼터 초과 에러인지 확인 (재시도 불필요)."""
    msg = str(err)
    return any(marker in msg for marker in _DAILY_QUOTA_MARKERS)


async def _invoke(llm: Any, messages: list, *, max_retries: int = 2, plain_fallback: bool = False) -> Any:
    """Gemini 호출 래퍼.

    - Semaphore로 워커당 동시 Gemini 호출 수 제한 (429 예방)
    - 일시적 429 (분당 제한): 지수 백오프 재시도 (최대 2회)
    - 일일 쿼터 초과: OpenAI gpt-5-mini 자동 폴백 (OPENAI_API_KEY 설정 시)
    - grounding LLM 429 / 미지원 에러 시: 일반 LLM으로 즉시 폴백 (plain_fallback=True)
    """
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
    """실제 Gemini/GPT 호출 로직 (Semaphore 제어는 _invoke에서 담당)."""
    for attempt in range(max_retries + 1):
        try:
            return await llm.ainvoke(messages)
        except Exception as e:
            msg = str(e)

            # grounding 미지원 모델 에러 → 일반 LLM으로 즉시 폴백
            if "grounding" in msg.lower() or "google_search" in msg.lower():
                logger.warning("Google Search grounding 미지원 – 일반 LLM으로 즉시 폴백")
                return await _get_llm().ainvoke(messages)

            # 일일 한도 초과 → OpenAI 폴백
            if _is_daily_quota(e):
                if settings.openai_api_key:
                    logger.warning("Gemini 일일 쿼터 초과 → gpt-5-mini 폴백 시도")
                    fallback = _get_fallback_llm()
                    result = await fallback.ainvoke(messages)

                    # reasoning 모델은 content 대신 additional_kwargs에 응답이 담길 수 있음
                    if not result.content:
                        ak = getattr(result, "additional_kwargs", {})
                        alt = (
                            ak.get("reasoning_content")
                            or ak.get("content")
                            or ak.get("text")
                            or ""
                        )
                        logger.warning(
                            "gpt-5-mini content 비어있음. additional_kwargs=%r, alt=%r",
                            {k: str(v)[:200] for k, v in ak.items()},
                            alt[:200] if alt else "",
                        )
                        if alt:
                            from langchain_core.messages import AIMessage
                            result = AIMessage(content=alt)

                    logger.info("gpt-5-mini 폴백 완료 (content_len=%d)", len(result.content or ""))
                    return result
                raise

            # 일시적 429 (분당 제한)
            if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                # grounding 호출 중 429 → 백오프 없이 즉시 일반 LLM으로 폴백
                if plain_fallback:
                    logger.warning("Gemini grounding 429 → 일반 LLM 즉시 폴백 (재시도 없음)")
                    return await _get_llm().ainvoke(messages)
                if attempt < max_retries:
                    # 지수 백오프 + jitter: 동시 429된 요청들이 같은 시점에 재시도하는 thundering herd 방지
                    base = 2 * (2 ** attempt)  # 2s → 4s
                    wait = base + random.uniform(0, base * 0.5)  # ±50% jitter
                    logger.warning("Gemini 429 일시 제한 – %.1f초 대기 후 재시도 (%d/%d)", wait, attempt + 1, max_retries)
                    await asyncio.sleep(wait)
                    continue
            raise


def _extract_text(content: Any) -> str:
    """LLM 응답 content에서 텍스트 추출 (str / list / grounding content_blocks 모두 처리).

    Google Search grounding 활성화 시 응답이 content_blocks 형태로 올 수 있음.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                # 일반 content list {"type": "text", "text": "..."}
                parts.append(part.get("text", ""))
        return "".join(parts)
    return str(content)


def _extract_text_from_response(response: Any) -> str:
    """LLM 응답 객체 전체에서 텍스트 추출.

    grounding 응답은 response.content_blocks 에 텍스트가 담기므로
    content_blocks → content → additional_kwargs 순으로 폴백한다.
    """
    # 1) content_blocks (Google Search grounding 응답)
    blocks = getattr(response, "content_blocks", None)
    if blocks:
        parts = []
        for block in blocks:
            if isinstance(block, dict):
                t = block.get("type", "")
                if t == "text":
                    parts.append(block.get("text", ""))
        text = "".join(parts).strip()
        if text:
            return text

    # 2) 일반 content
    return _extract_text(response.content)


def _parse_json(raw: Any) -> dict:
    """LLM 응답(또는 응답 객체)에서 JSON 블록 추출.

    grounding 응답의 content_blocks도 처리한다.
    """
    # 응답 객체인 경우 content_blocks → content 순 추출
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
    """YYYYMMDD → YYYY-MM-DD 변환. 포맷이 맞지 않으면 그대로 반환."""
    if len(d) == 8 and d.isdigit():
        return f"{d[:4]}-{d[4:6]}-{d[6:]}"
    return d


def _build_user_profile_block(profile: dict | None, lang: str = "Korean") -> str:
    """사용자 프로필 → 프롬프트 삽입 텍스트. 프로필이 없으면 빈 문자열."""
    if not profile:
        return ""

    gender = profile.get("gender") or "N/A"
    age_band = profile.get("age_band") or "N/A"
    dietary = profile.get("dietary_pref") or "regular"
    religion = profile.get("religion") or "none"
    nationality = profile.get("nationality") or ""

    lines = [
        "【User Travel Profile (consider for route recommendations)】",
        f"  • Nationality: {nationality}",
        f"  • Gender: {gender}",
        f"  • Age group: {age_band}",
        f"  • Diet: {dietary}",
        f"  • Religion: {religion}",
        "",
    ]

    notes: list[str] = []
    if dietary in ("채식", "비건", "Vegetarian", "Vegan"):
        notes.append(f"- Food routes: focus on vegetarian/vegan-friendly markets and streets.")
    if dietary in ("할랄", "Halal"):
        notes.append("- Food routes: focus on halal-certified or Muslim-friendly restaurants.")
    if religion in ("이슬람", "Muslim"):
        notes.append("- Avoid pork/alcohol venues; prioritize halal restaurants and Muslim-friendly attractions.")
    if religion in ("불교", "Buddhist"):
        notes.append("- Include Buddhist temples, cultural sites, and temple-stay experiences in sightseeing routes.")
    if religion in ("기독교", "천주교", "Christian", "Catholic"):
        notes.append("- Include churches, cathedrals, or Christian heritage sites in sightseeing routes.")

    if notes:
        lines.append("Personalization notes:")
        lines.extend(notes)
        lines.append("")

    if lang != "Korean":
        lines.append(f"Response language: {lang}")
        lines.append("")

    return "\n".join(lines) + "\n"


def _build_transport_block(transport_mode: str | None) -> str:
    """이동수단 → 프롬프트 지시 블록."""
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


async def generate_routes(state: PlannerState) -> PlannerState:
    """노드 1: 여행지 루트 7개 추천 (행사/먹거리/명소/럭셔리/가성비/가족/커플 테마)."""
    location_name = state.get("location_name") or state["location"]
    festivals: list = state.get("festivals") or []
    news_top10: list = state.get("news_top10") or []
    user_profile: dict | None = state.get("user_profile")
    existing_routes: list = state.get("existing_routes") or []
    start_date = state.get("start_date")
    end_date = state.get("end_date")
    weather_forecast: dict | None = state.get("weather_forecast")
    transport_mode: str | None = state.get("transport_mode")

    if start_date and end_date:
        period_clause = f"여행 기간: {start_date} ~ {end_date}\n"
    else:
        period_clause = ""

    if festivals:
        lines: list[str] = []
        for f in festivals[:5]:
            name = f.get("fstvlNm", "")
            place = f.get("opar", "")
            s = _format_festival_date(f.get("fstvlStartDate", ""))
            e = _format_festival_date(f.get("fstvlEndDate", ""))
            content = f.get("fstvlCo", "")[:50]
            line = f"  • {name} ({place}, {s}~{e})"
            if content:
                line += f" – {content}"
            lines.append(line)
        festival_block = "【여행 기간 내 해당 지역 행사】\n" + "\n".join(lines) + "\n\n"
        festival_theme_desc = (
            "1. 행사 중심: 위 행사를 핵심으로 구성. 행사명·개최 장소를 highlights에 반드시 포함하세요."
        )
    else:
        festival_block = ""
        festival_theme_desc = (
            "1. 행사/문화체험: 지역 대표 축제·전통 행사·문화 체험 위주 (현재 기간 행사 정보 없음, 대표적 문화행사로 대체)."
        )

    lang = _get_lang(user_profile)
    user_block = _build_user_profile_block(user_profile, lang)
    lang_dir = _lang_directive(lang)
    news_block = build_news_block_for_prompt(news_top10, location_name, for_k_content=False)
    weather_block = build_weather_block_for_prompt(weather_forecast or {}, start_date, end_date)
    transport_block = _build_transport_block(transport_mode)

    if existing_routes:
        quoted = ", ".join(f'"{r}"' for r in existing_routes)
        exclude_block = (
            f"【기존 루트(중복금지)】다음과 유사한 루트는 제외: {quoted}\n"
            f"이름·highlights 구성 모두 달라야 함.\n\n"
        )
    else:
        exclude_block = ""

    prompt = (
        f"여행지:{location_name} | {period_clause.strip()}\n"
        f"⚠️ 지역 제한(CRITICAL): highlights의 모든 장소는 반드시 '{location_name}' 지역 내에 "
        f"실제 존재해야 합니다. 이름이 비슷해도 다른 도시·지역 장소는 절대 포함 금지.\n\n"
        f"{user_block}{exclude_block}{festival_block}{weather_block}{transport_block}{news_block}"
        "아래 7가지 테마의 루트를 각 1개씩 순서대로 작성하세요:\n"
        f"1.{festival_theme_desc.split(':',1)[-1].strip()}\n"
        "2.먹거리:재래시장·먹자골목·특산물 중심\n"
        "3.명소:대표관광지·문화재·자연경관\n"
        "4.럭셔리:고급숙소·파인다이닝·스파·전용투어\n"
        "5.가성비:무료명소·저렴먹거리·대중교통 중심\n"
        "6.가족:키즈체험·동물원·놀이공원·자연탐방(유아·초등 기준)\n"
        "7.커플:야경·사진스팟·감성카페·데이트코스\n\n"
        f"highlights는 {location_name} 내 실존 장소·거리·행사만 사용.\n"
        f"{lang_dir}"
        "\nRespond ONLY with valid JSON (no explanation):\n"
        '{"routes":[{"name":"name(≤15chars)","theme":"행사|먹거리|명소|럭셔리|가성비|가족|커플",'
        '"description":"description(≤40chars)","highlights":["place1","place2","place3"]}]}'
    )

    use_search: bool = state.get("use_search", False)
    llm = _get_llm_with_search() if use_search else _get_llm()
    logger.info("루트 생성 LLM: %s", "Google Search grounding" if use_search else "기본 Gemini")
    try:
        response = await _invoke(llm, [HumanMessage(content=prompt)], plain_fallback=use_search)
        data = _parse_json(response)
        routes = data.get("routes", [])
        logger.info(
            "루트 생성 완료: %s개 (%s, 연동 행사=%d건, 유저 프로필=%s, 기존 제외=%d건)",
            len(routes), location_name, len(festivals), bool(user_profile), len(existing_routes),
        )
        return {**state, "routes": routes, "error": None}
    except Exception as e:
        logger.exception("루트 생성 실패: %s", e)
        return {**state, "routes": [], "error": str(e)}


def _build_date_list(start_date: str | None, end_date: str | None) -> list[str]:
    """start_date ~ end_date 범위의 날짜 문자열 리스트 반환."""
    if not start_date or not end_date:
        return []
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        n = max(1, (end_dt - start_dt).days + 1)
        return [(start_dt + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(n)]
    except ValueError:
        return []


def _build_festival_block(festivals: list) -> str:
    """행사 목록 → 프롬프트 블록."""
    if not festivals:
        return ""
    fest_lines: list[str] = []
    for f in festivals[:5]:
        name = f.get("fstvlNm", "")
        place = f.get("opar", "")
        s = _format_festival_date(f.get("fstvlStartDate", ""))
        e = _format_festival_date(f.get("fstvlEndDate", ""))
        content = f.get("fstvlCo", "")[:50]
        line = f"  • {name} ({place}, {s}~{e})"
        if content:
            line += f" – {content}"
        fest_lines.append(line)
    return (
        "【Local Events During Trip】\n"
        + "\n".join(fest_lines)
        + "\n- If any event matches the route theme, include it as a schedule item on the relevant day.\n\n"
    )


async def _generate_single_day(
    *,
    day_num: int,
    date_str: str,
    num_days: int,
    location_name: str,
    route_name: str,
    lang: str,
    lang_dir: str,
    festival_block: str,
    weather_block: str,
    transport_block: str,
    news_block: str,
    use_search: bool,
) -> tuple[list[dict[str, Any]], dict]:
    """하루치 일정 4개 항목을 Gemini로 생성한다.

    Returns:
        (items_list, per_day_cost_dict)
        per_day_cost_dict: {"day": int, "total": str, "total_krw": int}
    """
    time_labels = "morning|lunch|afternoon|evening" if lang != "Korean" else "오전|점심|오후|저녁"

    # 다일 여행 시 다른 날과 다른 구역 권장
    day_zone_hint = (
        f"- This is Day {day_num} of {num_days}. Explore a DIFFERENT district/area than other days.\n"
        if num_days > 1 else ""
    )

    prompt = (
        f"Destination:{location_name} | Route:{route_name} | Day:{day_num} ({date_str})\n"
        f"⚠️ GEOGRAPHIC CONSTRAINT (CRITICAL): ALL places must be physically located within "
        f"'{location_name}'. Never use places from other cities or regions.\n\n"
        f"{festival_block}{weather_block}{transport_block}{news_block}"
        f"Create exactly 4 schedule items for Day {day_num}.\n\n"
        "Rules:\n"
        f"- date field must be exactly: {date_str}\n"
        f"- day field must be exactly: {day_num}\n"
        f"- Use only real existing places within {location_name}\n"
        f"- time must be one of: {time_labels}\n"
        "- estimated_cost: cost in KRW (e.g. '무료', '₩3,000', '₩15,000~₩20,000')\n"
        "- address: 해당 장소의 정확한 도로명 주소\n"
        "- lat/lng: WGS84 decimal degree (approximate OK, geocoding will verify)\n"
        "- day_total_krw: integer estimate of total daily cost in KRW (midpoint if range)\n"
        "\n[GEOGRAPHIC EFFICIENCY – CRITICAL]\n"
        "- CLUSTER: All 4 places must be in the SAME neighborhood/district or adjacent areas.\n"
        "  Never scatter places across different parts of the city.\n"
        "- FLOW: Order morning→lunch→afternoon→evening so each next place is geographically CLOSE.\n"
        f"{day_zone_hint}"
        f"{lang_dir}"
        "\nRespond ONLY with valid JSON (no explanation):\n"
        f'{{"day":{day_num},"date":"{date_str}","items":['
        f'{{"time":"morning","place":"place name","address":"도로명 주소","lat":37.5665,"lng":126.9780,'
        '"title":"activity title(≤20chars)","description":"description(≤60chars)",'
        '"tips":"tip(≤30chars)","estimated_cost":"₩0"}'
        f'],"day_total":"₩0","day_total_krw":0}}'
    )

    llm = _get_llm_with_search() if use_search else _get_llm()
    response = await _invoke(llm, [HumanMessage(content=prompt)], plain_fallback=use_search)
    data = _parse_json(response)

    raw_items = data.get("items", [])
    day_total_str = data.get("day_total", "₩0")
    day_total_krw = data.get("day_total_krw", 0)

    # day/date 필드 보정 (LLM이 빠뜨리는 경우 대비)
    items = [{"day": day_num, "date": date_str, **{k: v for k, v in item.items() if k not in ("day", "date")}} for item in raw_items]

    per_day_cost = {"day": day_num, "total": day_total_str, "total_krw": day_total_krw}
    return items, per_day_cost


async def generate_schedule(state: PlannerState) -> PlannerState:
    """노드 2: 선택된 루트의 상세 일정 생성.

    날짜 범위가 있으면 일(Day)별로 Gemini를 병렬 호출하여 전체 대기 시간을
    sum(t_day) → max(t_day) 수준으로 단축한다.
    날짜 범위가 없을 때(레거시)는 단일 호출로 폴백한다.
    """
    location_name = state.get("location_name") or state["location"]
    route_name = state.get("route_name") or ""
    start_date = state.get("start_date")
    end_date = state.get("end_date")
    user_profile: dict | None = state.get("user_profile")
    festivals: list = state.get("festivals") or []
    news_top10: list = state.get("news_top10") or []
    weather_forecast: dict | None = state.get("weather_forecast")
    transport_mode: str | None = state.get("transport_mode")
    use_search: bool = state.get("use_search", False)

    lang = _get_lang(user_profile)
    lang_dir = _lang_directive(lang)
    news_block = build_news_block_for_prompt(news_top10, location_name, for_k_content=False)
    weather_block = build_weather_block_for_prompt(weather_forecast or {}, start_date, end_date)
    transport_block = _build_transport_block(transport_mode)
    festival_block = _build_festival_block(festivals)

    date_list = _build_date_list(start_date, end_date)

    # ── 병렬 호출 경로 (날짜 범위 있음) ──────────────────────────────────────
    if date_list:
        num_days = len(date_list)
        logger.info(
            "일정 병렬 생성 시작: %s / %s (%d일, use_search=%s)",
            location_name, route_name, num_days, use_search,
        )

        common_kwargs = dict(
            num_days=num_days,
            location_name=location_name,
            route_name=route_name,
            lang=lang,
            lang_dir=lang_dir,
            festival_block=festival_block,
            weather_block=weather_block,
            transport_block=transport_block,
            news_block=news_block,
            use_search=use_search,
        )
        tasks = [
            _generate_single_day(day_num=i + 1, date_str=date_str, **common_kwargs)
            for i, date_str in enumerate(date_list)
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        schedule: list[dict[str, Any]] = []
        per_day_costs: list[dict] = []
        errors: list[str] = []
        total_krw = 0

        for result in results:
            if isinstance(result, Exception):
                logger.error("일정 병렬 생성 일부 실패: %s", result)
                errors.append(str(result))
            else:
                items, per_day_cost = result
                schedule.extend(items)
                per_day_costs.append(per_day_cost)
                total_krw += per_day_cost.get("total_krw", 0)

        if errors and not schedule:
            return {**state, "schedule": [], "cost_summary": None, "error": "; ".join(errors)}

        # 일자 순 정렬
        schedule.sort(key=lambda x: (x.get("day", 0),))
        per_day_costs.sort(key=lambda x: x["day"])

        trip_total_str = f"₩{total_krw:,}" if total_krw else "N/A"
        cost_summary = {
            "per_day": [{"day": c["day"], "total": c["total"]} for c in per_day_costs],
            "trip_total": trip_total_str,
        }

        logger.info(
            "일정 병렬 생성 완료: %d개 항목 (%s / %s), 총경비=%s%s",
            len(schedule), location_name, route_name, trip_total_str,
            f" | 부분 실패 {len(errors)}건" if errors else "",
        )
        return {**state, "schedule": schedule, "cost_summary": cost_summary, "error": None}

    # ── 단일 호출 폴백 (날짜 범위 없음) ─────────────────────────────────────
    num_days = _TRAVEL_DAYS_DEFAULT
    date_example = "YYYY-MM-DD"
    time_labels = "morning|lunch|afternoon|evening" if lang != "Korean" else "오전|점심|오후|저녁"

    prompt = (
        f"Destination:{location_name} | Route:{route_name}\n"
        f"⚠️ GEOGRAPHIC CONSTRAINT (CRITICAL): ALL places must be physically located within "
        f"'{location_name}'. Never use places from other cities or regions, even if names are similar.\n\n"
        f"{festival_block}{weather_block}{transport_block}{news_block}"
        f"Create a detailed travel itinerary ({num_days} days, 4 items per day).\n\n"
        "Rules:\n"
        f"- Use only real existing places/restaurants/attractions within {location_name}\n"
        f"- time must be one of: {time_labels}\n"
        "- estimated_cost: cost in KRW (e.g. '무료', '₩3,000', '₩15,000~₩20,000')\n"
        "- cost_summary.per_day: sum of estimated_cost for each day\n"
        "- cost_summary.trip_total: grand total\n"
        "- address: 해당 장소의 정확한 도로명 주소\n"
        "- lat/lng: WGS84 decimal degree (approximate OK)\n"
        "\n[GEOGRAPHIC EFFICIENCY – CRITICAL]\n"
        "- CLUSTER: Each day's 4 places must be in the SAME neighborhood/district.\n"
        "- FLOW: Order morning→lunch→afternoon→evening geographically close.\n"
        "- MULTI-DAY: Assign DIFFERENT districts to different days.\n"
        f"{lang_dir}"
        "\nRespond ONLY with valid JSON (no explanation):\n"
        f'{{"schedule":[{{"day":1,"date":"{date_example}","time":"morning","place":"place name",'
        '"address":"도로명 주소","lat":37.5665,"lng":126.9780,'
        '"title":"activity title(≤20chars)","description":"description(≤60chars)",'
        '"tips":"tip(≤30chars)","estimated_cost":"₩0"}}],'
        '"cost_summary":{{"per_day":[{{"day":1,"total":"₩0"}}],"trip_total":"₩0"}}}}'
    )

    llm = _get_llm_with_search() if use_search else _get_llm()
    logger.info("일정 단일 생성(폴백) LLM: %s", "Google Search grounding" if use_search else "기본 Gemini")
    try:
        response = await _invoke(llm, [HumanMessage(content=prompt)], plain_fallback=use_search)
        data = _parse_json(response)
        schedule = data.get("schedule", [])
        cost_summary = data.get("cost_summary")
        logger.info(
            "일정 생성 완료: %s개 항목 (%s / %s), 총경비=%s",
            len(schedule), location_name, route_name,
            (cost_summary or {}).get("trip_total", "N/A"),
        )
        return {**state, "schedule": schedule, "cost_summary": cost_summary, "error": None}
    except Exception as e:
        logger.exception("일정 생성 실패: %s", e)
        return {**state, "schedule": [], "cost_summary": None, "error": str(e)}


async def modify_schedule(
    schedule: list[dict[str, Any]],
    instruction: str,
    location: str,
    user_profile: dict | None = None,
) -> dict[str, Any]:
    """사용자 자연어 지시로 일정 특정 항목 수정.

    Returns:
        {"schedule": [...], "modified_titles": [...]}
    """
    lang = _get_lang(user_profile)
    lang_dir = _lang_directive(lang)
    schedule_json = json.dumps(schedule, ensure_ascii=False, separators=(",", ":"))

    # 영화 관련 요청이면 KOBIS 실시간 박스오피스 데이터를 프롬프트에 주입
    kobis_block = ""
    if is_movie_query(instruction):
        movies = await fetch_boxoffice()
        ctx = format_boxoffice_context(movies)
        if ctx:
            kobis_block = f"\n{ctx}\n"
            logger.info("KOBIS 박스오피스 컨텍스트 주입 (modify_schedule)")

    prompt = (
        f'Destination:{location}\n'
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
        not_possible: bool = data.get("not_possible", False)
        reason: str = data.get("reason", "")
        logger.info("일정 수정 완료: %s | 불가:%s | 이유:%s", data.get("modified_titles", []), not_possible, reason)
        return {
            "schedule": data.get("schedule", schedule),
            "modified_titles": data.get("modified_titles", []),
            "not_possible": not_possible,
            "reason": reason,
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
    """단일 일정 항목 리롤 – 해당 항목만 새로 생성.

    Returns:
        교체된 단일 아이템 dict
    """
    day = item.get("day", 1)
    date_str = item.get("date", "")
    time_str = item.get("time", "")

    lang = _get_lang(user_profile)
    lang_dir = _lang_directive(lang)

    same_day_titles = [
        s["title"] for s in schedule
        if s.get("day") == day and s.get("title") != item.get("title")
    ]
    same_day_ctx = (
        f"Other items same day (no duplicates): {', '.join(same_day_titles)}"
        if same_day_titles else ""
    )

    # 영화 관련 항목(제목·장소에 극장/영화 키워드) 리롤 시 KOBIS 컨텍스트 주입
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
    try:
        response = await _invoke(llm, [HumanMessage(content=prompt)])
        new_item = _parse_json(response)
        logger.info("항목 리롤 완료: %s → %s", item.get("title"), new_item.get("title"))
        return new_item
    except Exception as e:
        logger.exception("항목 리롤 실패: %s", e)
        raise


async def _geocode_item(item: dict[str, Any]) -> dict[str, Any]:
    """단일 일정 항목에 대해 Naver Geocoding API로 좌표를 보강한다.

    우선순위:
    1. address 필드로 지오코딩 → 성공 시 검증된 좌표로 덮어쓰기
    2. 실패 시 place 이름으로 재시도
    3. 모두 실패 시 Gemini가 생성한 lat/lng 유지
    """
    # 주소 우선, 없으면 장소명으로 시도
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
                # 검증된 도로명 주소로 갱신 (있을 경우)
                "address": result.get("road_address") or result.get("address") or item.get("address", ""),
            }

    # 지오코딩 실패 → Gemini 좌표 그대로 유지
    return item


async def geocode_schedule(state: PlannerState) -> PlannerState:
    """노드: Naver Geocoding API로 일정 장소의 좌표를 검증·보강하고 경로를 최적화한다.

    처리 순서:
    1. 모든 항목 병렬 지오코딩 (정확한 좌표 확보)
    2. 일별로 그룹화 후 Nearest Neighbor TSP로 방문 순서 최적화
       - 같은 날 장소들을 최단 이동 순서로 재배열
       - 시간 슬롯(오전→점심→오후→저녁) 재배정
    3. 최적화 전후 총 이동 거리 로그 출력
    """
    schedule: list[dict[str, Any]] = state.get("schedule", [])
    if not schedule:
        return state

    # 1) 병렬 지오코딩
    geocoded = list(await asyncio.gather(*[_geocode_item(item) for item in schedule]))

    ok_count = sum(1 for g in geocoded if g.get("lat") and g.get("lng"))
    logger.info("지오코딩 완료: %d/%d 항목에 좌표 확보", ok_count, len(geocoded))

    # 2) 일별 경로 최적화 (Nearest Neighbor TSP)
    days_map: dict[int, list[dict[str, Any]]] = {}
    for item in geocoded:
        d = item.get("day", 1)
        days_map.setdefault(d, []).append(item)

    optimized: list[dict[str, Any]] = []
    total_before = 0.0
    total_after  = 0.0

    for day_num in sorted(days_map.keys()):
        day_items = days_map[day_num]
        before_km = _total_route_km(day_items)

        reordered = _optimize_day_order(day_items)
        after_km  = _total_route_km(reordered)

        total_before += before_km
        total_after  += after_km
        optimized.extend(reordered)

        logger.info(
            "Day%d 경로 최적화: %.1fkm → %.1fkm (%.0f%% 단축)",
            day_num, before_km, after_km,
            (1 - after_km / before_km) * 100 if before_km > 0 else 0,
        )

    if total_before > 0:
        logger.info(
            "전체 경로 최적화 완료: %.1fkm → %.1fkm (총 %.0f%% 단축)",
            total_before, total_after,
            (1 - total_after / total_before) * 100,
        )

    return {**state, "schedule": optimized}


async def enrich_business_hours_schedule(state: PlannerState) -> PlannerState:
    """네이버 플레이스에서 영업시간을 붙인다 (NAVER_PLACE_HOURS_ENABLED=1 일 때만)."""
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
