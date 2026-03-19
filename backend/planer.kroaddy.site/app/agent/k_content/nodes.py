"""K-Content 하이브리드 일정 에이전트 노드.

Standard 플래너의 프롬프팅/파싱/재시도 유틸리티를 유지하면서,
DB(K-콘텐츠 패키지/장소) + Gemini Search/Grounding을 결합해 일정 생성합니다.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Any, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from sqlalchemy import select

from app.agent.k_content.state import KContentPlaceInfo, KContentState
from app.core.config import settings
from app.core.database.session import AsyncSessionLocal
from app.models.k_content import KContentPackage, KContentPlace
from app.agent.standard.state import PlannerState

logger = logging.getLogger(__name__)

_TRAVEL_DAYS_DEFAULT = 2


# =========================
# Standard 유틸리티 복제 영역
# =========================

# 국적 → Gemini 응답 언어 지시 매핑 (Standard과 동일)
_NATIONALITY_TO_LANG: dict[str, str] = {
    "한국": "Korean",
    "USA": "English",
    "United Kingdom": "English",
    "Australia": "English",
    "Canada": "English",
    "Singapore": "English",
    "India": "English",
    "Malaysia": "English",
    "Philippines": "English",
    "Indonesia": "English",
    "Thailand": "English",
    "Other": "English",
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
        notes.append("- Food routes: focus on vegetarian/vegan-friendly markets and streets.")
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


def _get_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model="gemini-3-flash-preview",
        temperature=0.4,
        google_api_key=settings.gemini_api_key,
    )


def _get_llm_with_search():
    llm = ChatGoogleGenerativeAI(
        model="gemini-3-flash-preview",
        temperature=0.4,
        google_api_key=settings.gemini_api_key,
    )
    return llm.bind_tools([{"google_search": {}}])


def _get_fallback_llm():
    from langchain_openai import ChatOpenAI  # lazy import

    return ChatOpenAI(
        model="gpt-5-mini",
        openai_api_key=settings.openai_api_key,
    )


_DAILY_QUOTA_MARKERS = (
    "GenerateRequestsPerDayPerProjectPerModel",
    "You exceeded your current quota",
    "check your plan and billing details",
)


def _is_daily_quota(err: Exception) -> bool:
    msg = str(err)
    return any(marker in msg for marker in _DAILY_QUOTA_MARKERS)


async def _invoke(llm: Any, messages: list, *, max_retries: int = 2) -> Any:
    """Gemini 호출 래퍼. (Standard 구현과 동일)"""
    for attempt in range(max_retries + 1):
        try:
            return await llm.ainvoke(messages)
        except Exception as e:
            msg = str(e)

            # grounding 미지원 모델 에러 → 일반 LLM으로 한 번 재시도
            if "grounding" in msg.lower() or "google_search" in msg.lower():
                logger.warning("Google Search grounding 미지원 – 일반 LLM으로 재시도")
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
                # API 키 없으면 원래 에러 그대로 올림
                raise

            # 일시적 429 (분당 제한) → 백오프 후 재시도
            if ("429" in msg or "RESOURCE_EXHAUSTED" in msg) and attempt < max_retries:
                wait = 4 * (2 ** attempt)  # 4초 → 8초
                logger.warning("Gemini 429 일시 제한 – %d초 대기 후 재시도 (%d/%d)", wait, attempt + 1, max_retries)
                await asyncio.sleep(wait)
                continue
            raise


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
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
        parts: list[str] = []
        for block in blocks:
            if isinstance(block, dict):
                t = block.get("type", "")
                if t == "text":
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


# =========================
# K-Content 노드 로직
# =========================


async def fetch_k_content_node(state: KContentState) -> KContentState:
    """노드 1: package_id로 DB에서 KContentPackage와 KContentPlace 정보를 가져온다."""
    package_id = state.get("package_id")
    if not package_id:
        return {**state, "db_places": [], "external_places": [], "places": [], "error": "package_id missing"}

    factory = AsyncSessionLocal()
    async with factory() as db:
        pkg_result = await db.execute(select(KContentPackage).where(KContentPackage.package_id == package_id))
        pkg = pkg_result.scalar_one_or_none()
        if not pkg:
            return {
                **state,
                "package_meta": {},
                "db_places": [],
                "external_places": [],
                "places": [],
                "error": f"package not found: {package_id}",
            }

        place_result = await db.execute(select(KContentPlace).where(KContentPlace.package_id == package_id))
        rows = place_result.scalars().all()

    # session close 이후에도 rows 객체를 참조하되, 필요한 값만 추출해 안전하게 dict로 변환
    db_places: list[KContentPlaceInfo] = []
    for r in rows:
        db_places.append(
            {
                "place_id": r.place_id,
                "name_en": r.name_en,
                "name_ko": r.name_ko,
                "lat": float(r.lat),
                "lng": float(r.lng),
                "description_en": r.description_en,
                "must_do_en": r.must_do_en,
                "source": "db",
            }
        )

    package_meta = {
        "package_id": pkg.package_id,
        "category": pkg.category,
        "title_en": pkg.title_en,
        "title_ko": pkg.title_ko,
        "description_en": pkg.description_en,
        "image_url": pkg.image_url,
        "tags": pkg.tags,
    }

    return {
        **state,
        "package_meta": package_meta,
        "db_places": db_places,
        "external_places": [],
        "places": db_places,
        "error": None,
    }


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


async def generate_k_schedule_node(state: KContentState) -> KContentState:
    """노드 2: DB 핵심 앵커 + Gemini Search로 하이브리드 일정 생성."""
    location_name = state.get("location_name") or state.get("location") or ""
    start_date = state.get("start_date")
    end_date = state.get("end_date")
    user_profile: dict | None = state.get("user_profile")

    db_places: list[dict[str, Any]] = state.get("db_places") or []
    package_meta: dict = state.get("package_meta") or {}

    # Language / time slots
    lang = _get_lang(user_profile)
    lang_dir = _lang_directive(lang)
    time_labels = ["오전", "점심", "오후", "저녁"] if lang == "Korean" else ["morning", "lunch", "afternoon", "evening"]

    date_list = _build_date_list(start_date, end_date)
    num_days = len(date_list) if date_list else _TRAVEL_DAYS_DEFAULT
    date_example = date_list[0] if date_list else "YYYY-MM-DD"

    date_clause = ""
    if date_list:
        mapping = " | ".join(f"Day{i+1}:{d}" for i, d in enumerate(date_list))
        date_clause = f"Period:{start_date}~{end_date}({num_days}days) | DateMapping:{mapping}\n"

    # 핵심 추천 후보 블록 (필수 포함이 아닌 우선 후보)
    anchors_lines: list[str] = []
    for i, p in enumerate(db_places, start=1):
        anchors_lines.append(
            f"{i}. name_en: {p.get('name_en','')}\n"
            f"   name_ko: {p.get('name_ko','')}\n"
            f"   description_en: {p.get('description_en','')}\n"
            f"   must_do_en: {p.get('must_do_en','')}\n"
        )

    db_places_json = json.dumps(db_places, ensure_ascii=False, separators=(",", ":"))
    user_block = _build_user_profile_block(user_profile, lang=lang)

    package_title = package_meta.get("title_en", "")
    if lang == "Korean" and package_meta.get("title_ko"):
        package_title = package_meta.get("title_ko") or package_title

    # System prompt: DB 장소 강제 포함 완화 + 동선 최적화 중심
    korean_only_rule = ""
    if lang == "Korean":
        korean_only_rule = (
            "7) If output language is Korean, all narrative fields must be fully Korean: title, description, tips, and place labels.\n"
            "   Do not mix English phrases in a sentence. English is allowed only for unavoidable proper nouns/brand names.\n"
        )
    system_prompt = (
        "You are a travel itinerary planner for K-Content mode.\n"
        "You will receive hybrid data sources: DB recommendation list + external suggestions via search.\n\n"
        "IMPORTANT RULES:\n"
        "1) Treat db_places as a core recommendation list, not mandatory homework.\n"
        "2) Place about 50-60% of the itinerary using well-connected db_places first; fill the rest with external places from real-time search based on user profile.\n"
        "3) If a DB place is too far from other selected places or harms route efficiency, you may skip it and suggest a better alternative.\n"
        "4) Make the route feel naturally curated by an expert: add good cafes/rest spots before/after key visits.\n"
        "5) For non-DB places, keep strong thematic consistency with the package title/category (e.g., artist fandom, trend/luxury, healing/retro).\n"
        "6) 응답 JSON의 time_label은 지정된 언어 규칙을 엄격히 따라라.\n"
        f"{korean_only_rule}"
    )

    prompt = (
        f"Destination:{location_name}\n"
        f"K-Content Package:{package_title} ({package_meta.get('category','')})\n"
        f"{date_clause}\n"
        f"\n【db_places (core recommendation list, optional-by-route-efficiency)】\n"
        f"{anchors_lines and ''.join(anchors_lines) or '[]'}\n"
        f"\nRaw db_places JSON (for exact matching):\n{db_places_json}\n\n"
        f"{user_block}"
        f"\nCreate a detailed travel itinerary ({num_days} days, 4 items per day).\n\n"
        "Rules:\n"
        "- Use db_places as high-priority candidates, but do NOT force all of them.\n"
        "- Keep roughly 50-60% of schedule items from db_places (when feasible), and use external search results for the rest.\n"
        "- If a db_place is geographically inefficient, skip it and choose a better nearby alternative.\n"
        "- External places must align with the package title/category mood and fandom context, not generic tourist picks.\n"
        "- Explain in description/tips why each external place matches the package theme.\n"
        "- When lang is Korean and name_ko is available, use name_ko as the display value for schedule item place.\n"
        "- description_en/must_do_en from db_places must be reflected in the relevant schedule item's description/tips.\n"
        "- Around key visits, add natural transitions (cafes/rest spots) from real-time search.\n"
        "- For meal slots, prefer profile-aware restaurant choices (nationality/dietary/religion).\n"
        "- Do NOT invent fictional places; use realistic places/streets/restaurants.\n"
        "- If output language is Korean, keep each sentence fully Korean (except unavoidable proper nouns).\n"
        "- Avoid bilingual mixed sentences like 'English + 한국어' in description/tips.\n"
        f"- time_label must be exactly one of: {time_labels}\n"
        "- cost_summary.per_day: sum of estimated_cost for each day (formatted KRW string)\n"
        "- cost_summary.trip_total: grand total for the entire trip\n"
        "- estimated_cost must be KRW string (e.g. '무료', '₩3,000', '₩15,000~₩20,000')\n"
        f"{lang_dir}\n\n"
        "Respond ONLY with valid JSON (no explanation):\n"
        '{'
        '"schedule":['
        '{"day":1,"date":"YYYY-MM-DD","time_label":"time slot","place":"place name",'
        '"title":"activity title","description":"description","tips":"tip","estimated_cost":"₩0"}'
        "],"
        '"cost_summary":{"per_day":[{"day":1,"total":"₩0"}],"trip_total":"₩0"},'
        '"external_places":[{"name_en":"place name","description_en":"...","must_do_en":"..."}]'
        "}"
    )

    llm = _get_llm_with_search()
    try:
        response = await _invoke(llm, [SystemMessage(content=system_prompt), HumanMessage(content=prompt)])
        data = _parse_json(response)

        schedule = data.get("schedule", [])
        cost_summary = data.get("cost_summary")
        external_places_raw = data.get("external_places", []) or []

        external_places: list[KContentPlaceInfo] = []
        for p in external_places_raw:
            item: KContentPlaceInfo = {
                "place_id": p.get("place_id"),  # optional
                "name_en": p.get("name_en") or "",
                "description_en": p.get("description_en"),
                "must_do_en": p.get("must_do_en"),
                "source": "external",
            }
            # LLM이 lat/lng를 주지 않을 수 있으므로 있으면만 반영
            if p.get("lat") is not None:
                item["lat"] = float(p.get("lat"))
            if p.get("lng") is not None:
                item["lng"] = float(p.get("lng"))
            external_places.append(item)

        places = (state.get("db_places") or []) + external_places

        return {
            **state,
            "schedule": schedule,
            "cost_summary": cost_summary,
            "external_places": external_places,
            "places": places,
            "error": None,
        }
    except Exception as e:
        logger.exception("generate_k_schedule_node 실패: %s", e)
        return {
            **state,
            "schedule": [],
            "cost_summary": None,
            "external_places": [],
            "places": state.get("db_places") or [],
            "error": str(e),
        }
