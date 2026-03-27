"""K-Content 하이브리드 일정 에이전트 노드.

Standard 플래너의 프롬프팅/파싱/재시도 유틸리티를 유지하면서,
DB(K-콘텐츠 패키지/장소) + Gemini Search/Grounding을 결합해 일정 생성합니다.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import random
import re
from datetime import datetime, timedelta
from typing import Any, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from sqlalchemy import select

from app.agent.k_content.state import KContentPlaceInfo, KContentState
from app.api.v1.k_content.schemas import KF_SENTINEL_DB_ID, build_legacy_package_id
from app.core.config import settings
from app.core.database.session import AsyncSessionLocal
from app.models.k_content import KContentPackage, KContentPlace
from app.agent.standard.state import PlannerState
from app.services.news_client import build_news_block_for_prompt

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

# 워커당 동시 Gemini 호출 최대 수 – 429 예방
_GEMINI_SEMAPHORE = asyncio.Semaphore(20)
_SEMAPHORE_WAIT_TIMEOUT = 30  # 초


def _is_daily_quota(err: Exception) -> bool:
    msg = str(err)
    return any(marker in msg for marker in _DAILY_QUOTA_MARKERS)


async def _invoke(llm: Any, messages: list, *, max_retries: int = 2, plain_fallback: bool = False) -> Any:
    """Gemini 호출 래퍼.

    - Semaphore로 워커당 동시 Gemini 호출 수 제한 (429 예방)
    - 일시적 429 (분당 제한): 지수 백오프 + jitter 재시도
    - 일일 쿼터 초과: OpenAI gpt-5-mini 자동 폴백 (OPENAI_API_KEY 설정 시)
    - grounding 호출 중 429/미지원 에러 시: 일반 LLM 즉시 폴백
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

            # grounding 미지원 모델 에러 → 일반 LLM 즉시 폴백
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
                # API 키 없으면 원래 에러 그대로 올림
                raise

            # 일시적 429 (분당 제한)
            if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                # grounding 호출 중 429 → 백오프 없이 즉시 일반 LLM으로 폴백
                if plain_fallback:
                    logger.warning("Gemini grounding 429 → 일반 LLM 즉시 폴백 (재시도 없음)")
                    return await _get_llm().ainvoke(messages)

                if attempt < max_retries:
                    # 지수 백오프 + jitter: 동시 재시도 폭주(thundering herd) 완화
                    base = 2 * (2 ** attempt)  # 2초 → 4초
                    wait = base + random.uniform(0, base * 0.5)  # +0~50% jitter
                    logger.warning("Gemini 429 일시 제한 – %.1f초 대기 후 재시도 (%d/%d)", wait, attempt + 1, max_retries)
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
    """노드 1: package_id(int)로 DB에서 KContentPackage와 KContentPlace 정보를 가져온다."""
    package_id = state.get("package_id")
    if not package_id:
        return {**state, "db_places": [], "external_places": [], "places": [], "error": "package_id missing"}

    # K-FOOD (KF_*) — DB 시드 전: 합성 package_meta만 주입 (KPOP/KDRAMA 경로와 분리)
    if package_id == KF_SENTINEL_DB_ID:
        legacy = (state.get("legacy_package_ref") or "KF_MARKET").strip().upper()
        if legacy == "KF_MARKET":
            title_ko = "전국 전통시장 먹거리 탐방"
            title_en = "Traditional market food tour across Korea"
            description_en = "Walking food relay inside one Korean traditional market."
            tags = "traditional market, food, KFOOD"
        elif legacy == "KF_CAFE":
            title_ko = "K-디저트 & 카페 감성 투어"
            title_en = "K-dessert and vibe-matched cafe tour"
            description_en = (
                "Vibe-based 1-day course: cafe, shop/store, dining/pub with geographic and aesthetic curation."
            )
            tags = "카페, 디저트, 편집샵, 감성투어, KFOOD"
        else:
            title_ko = legacy.replace("_", " ")
            title_en = "K-Food experience"
            description_en = "K-Food themed tour."
            tags = "KFOOD"
        package_meta = {
            "id": KF_SENTINEL_DB_ID,
            "package_id": legacy,
            "category": "KFOOD",
            "title_en": title_en,
            "title_ko": title_ko,
            "description_en": description_en,
            "image_url": None,
            "tags": tags,
        }
        return {
            **state,
            "package_meta": package_meta,
            "db_places": [],
            "external_places": [],
            "places": [],
            "error": None,
        }

    factory = AsyncSessionLocal()
    async with factory() as db:
        pkg_result = await db.execute(select(KContentPackage).where(KContentPackage.id == package_id))
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
                "id": r.id,
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
        "id": pkg.id,
        "package_id": build_legacy_package_id(db_id=pkg.id, category=pkg.category),
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


def _extract_anchor_center(db_places: list[dict[str, Any]]) -> tuple[float, float] | None:
    coords: list[tuple[float, float]] = []
    for p in db_places:
        try:
            lat = p.get("lat")
            lng = p.get("lng")
            if lat is None or lng is None:
                continue
            coords.append((float(lat), float(lng)))
        except Exception:
            continue
    if not coords:
        return None
    lat_avg = sum(lat for lat, _ in coords) / len(coords)
    lng_avg = sum(lng for _, lng in coords) / len(coords)
    return lat_avg, lng_avg


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2) + math.cos(p1) * math.cos(p2) * (math.sin(dlng / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _extract_theme_keywords(package_meta: dict[str, Any]) -> str:
    parts = [
        str(package_meta.get("title_ko") or "").strip(),
        str(package_meta.get("title_en") or "").strip(),
        str(package_meta.get("tags") or "").strip(),
        str(package_meta.get("description_en") or "").strip(),
    ]
    merged = " | ".join([p for p in parts if p])
    return merged or "the package mood and narrative tone"


def _is_kf_market_mode(package_meta: dict[str, Any], legacy_ref: str | None) -> bool:
    """KF_MARKET 전용 모드 (KPOP/KDRAMA와 분리)."""
    pid = str(package_meta.get("package_id") or "").upper()
    leg = (legacy_ref or "").strip().upper()
    return pid == "KF_MARKET" or leg == "KF_MARKET"


def _is_kf_cafe_mode(package_meta: dict[str, Any], legacy_ref: str | None) -> bool:
    pid = str(package_meta.get("package_id") or "").upper()
    leg = (legacy_ref or "").strip().upper()
    return pid == "KF_CAFE" or leg == "KF_CAFE"


def _kf_cafe_user_keyword(user_profile: dict | None) -> str:
    if not user_profile:
        return ""
    kw = user_profile.get("keyword")
    return kw.strip() if isinstance(kw, str) else ""


def _kf_cafe_picked_vibe(user_profile: dict | None) -> str:
    """프론트 user_profile.pickedVibe / picked_vibe (Vibe 카테고리 ID 등)."""
    if not user_profile:
        return ""
    for key in ("pickedVibe", "picked_vibe"):
        v = user_profile.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


# 서울 시청 인근 — Vibe-only 일 때 100km 반경 필터 기준점
_KF_CAFE_DEFAULT_ANCHOR: tuple[float, float] = (37.5665, 126.9780)

_KF_CAFE_CURATOR_SYSTEM = """당신은 한국의 공간 트렌드와 'Vibe(감성)'를 데이터 기반으로 분석하는 큐레이션 전문가입니다. 사용자가 선택한 [Vibe] 또는 [특정 카페명]을 바탕으로, 감성적 일관성이 흐르는 1일 투어 코스를 설계합니다.

### 1. Vibe Taxonomy & Definitions (감성 상세 정의)
제시된 5가지 카테고리의 정의를 엄격히 준수하여 장소를 매칭하세요.
- **industrial_raw**: #성수동감성 #공장개조 #거친미학 (노출 콘크리트, 철제, 붉은 벽돌, 업사이클링 공간)
- **traditional_zen**: #한옥 #여백의미 #동양적미니멀리즘 (서까래, 나무/돌 소재, 정갈한 다도 공간, 고요함)
- **nature_botanical**: #통유리 #식물원 #숲뷰/강뷰 (플랜테리어, 자연광, 대형 베이커리, 교외 힐링 공간)
- **retro_newtro**: #을지로감성 #빈티지8090 #노포의재발견 (자개장, 화려한 패턴, 골목길, 레트로 소품/LP)
- **modern_minimal**: #무채색 #금속/유리 #실험적조형미 (블랙&화이트, 미니멀 가구, 미디어 아트, 세련된 갤러리풍)

### 2. Operational Logic (운영 로직)
- **Geographic Constraint (100km)**:
  - 사용자가 입력한 [카페명]의 실제 위치를 기준점으로 삼습니다.
  - 특정 카페명이 없고 [Vibe]만 선택된 경우 '서울(Seoul)'을 기준점으로 삼습니다.
  - 모든 추천 장소는 기준점으로부터 **직선거리 100km 이내**에 위치해야 합니다.
- **Vibe Consistency**: 첫 번째(카페)와 두 번째(편집샵/스토어) 장소는 선택된 Vibe와 완벽히 일치해야 합니다.
- **Vibe Twist (반전 코스)**: 마지막 세 번째 장소(식당/펍)는 이전 장소들과 대비되는 감성을 선정하여 리프레시를 제공하세요. (예: 하루 종일 Industrial했다면 마지막은 Zen 감성으로 마무리)

### 3. Output Requirements (출력 요구사항)
- 반드시 한국어로 답변하며, 결과는 JSON 형식으로만 출력합니다.
- 각 장소의 '선정이유(vibe_reason)'에는 해당 공간의 인테리어적 특징과 Vibe 매칭 포인트를 구체적으로 적으세요.
- Google Search(도구)를 활용해 실제 존재 가능한 상호·위치를 우선합니다.

### 4. Output JSON Schema (구조)
반드시 아래 키만 사용하는 단일 JSON 객체를 출력하세요.
{
  "vibe_category": "선택된 카테고리 ID (industrial_raw | traditional_zen | nature_botanical | retro_newtro | modern_minimal 중 하나)",
  "tour_theme": "감성적인 투어 제목 (예: 성수의 거친 숨결을 찾아서)",
  "itinerary": [
    {
      "order": 1,
      "place_name": "장소명 (지역구 포함, 예: 성수동 텅플래닛)",
      "category": "Cafe",
      "vibe_reason": "장소 선정 이유 및 감성 설명",
      "coord_context": "대략적인 위치 정보 (예: 성수역 도보 5분)",
      "lat": null,
      "lng": null
    },
    {
      "order": 2,
      "place_name": "장소명",
      "category": "Shop/Brand Store",
      "vibe_reason": "장소 선정 이유 및 카페와의 감성 연결성 설명",
      "coord_context": "첫 장소와의 이동 편의성",
      "lat": null,
      "lng": null
    },
    {
      "order": 3,
      "place_name": "장소명 (Vibe Twist)",
      "category": "Dining/Pub",
      "vibe_reason": "반전의 묘미 및 마무리 감성 설명",
      "coord_context": "최종 동선 정보",
      "lat": null,
      "lng": null
    }
  ]
}
(lat/lng는 알 수 있으면 숫자로 채우고, 불확실하면 null)
"""


def _tour_title_clip(s: str, n: int) -> str:
    return s if len(s) <= n else s[: n - 1] + "…"


def _kf_cafe_itinerary_to_schedule(
    data: dict[str, Any],
    *,
    start_date: str,
    lang: str,
) -> dict[str, Any]:
    """KF_CAFE 전용 JSON(itinerary 3 stops) → 기존 schedule / cost / external_places 형식."""
    tour_theme = str(data.get("tour_theme") or "카페 감성 투어").strip()
    items = data.get("itinerary") if isinstance(data.get("itinerary"), list) else []
    time_labels = ["오전", "점심", "저녁"] if lang == "Korean" else ["morning", "lunch", "evening"]
    times_hhmm = ["10:30", "14:00", "18:30"]
    day_date = (start_date or "").strip() or datetime.now().strftime("%Y-%m-%d")

    schedule: list[dict[str, Any]] = []
    external_places: list[KContentPlaceInfo] = []

    for i, row in enumerate(items[:3]):
        if not isinstance(row, dict):
            continue
        place_name = str(row.get("place_name") or "").strip()
        if not place_name:
            continue
        cat = str(row.get("category") or "").strip()
        vibe_reason = str(row.get("vibe_reason") or "").strip()
        coord_ctx = str(row.get("coord_context") or "").strip()
        slot = min(i, len(time_labels) - 1)
        title = f"{tour_theme} · {cat}" if cat else _tour_title_clip(tour_theme, 80)

        schedule.append(
            {
                "day": 1,
                "date": day_date,
                "time": times_hhmm[i] if i < len(times_hhmm) else "12:00",
                "time_label": time_labels[slot],
                "place": place_name,
                "title": title[:120],
                "description": vibe_reason,
                "tips": coord_ctx,
                "estimated_cost": "현장·메뉴에 따라 상이",
            }
        )
        item: KContentPlaceInfo = {
            "name_en": place_name,
            "description_en": vibe_reason,
            "must_do_en": coord_ctx,
            "source": "external",
        }
        item["name_ko"] = place_name
        try:
            lat = row.get("lat")
            lng = row.get("lng")
            if lat is not None and lng is not None:
                item["lat"] = float(lat)
                item["lng"] = float(lng)
        except (TypeError, ValueError):
            pass
        external_places.append(item)

    cost_summary = {
        "per_day": [{"day": 1, "total": "일정별 현장 확인"}],
        "trip_total": "일정별 현장 확인",
    }
    return {"schedule": schedule, "cost_summary": cost_summary, "external_places": external_places}


def _kf_market_focus_name(user_profile: dict | None, location_name: str) -> str:
    if user_profile:
        kw = user_profile.get("keyword") or user_profile.get("market_keyword")
        if isinstance(kw, str) and kw.strip():
            return kw.strip()
    return (location_name or "").strip()


async def _kf_market_review_schedule_json(
    data: dict[str, Any],
    *,
    market_name: str,
    lang: str,
) -> dict[str, Any]:
    """KF_MARKET: 1차 생성 결과가 시장·먹거리 맥락에 맞는지 LLM으로 재검증."""
    lang_note = "Korean" if lang == "Korean" else lang
    verify_system = (
        "You are a strict QA reviewer for Korean traditional market food tours.\n"
        "Remove or rewrite schedule items and external_places that are clearly outside the target market walking area "
        "or not about market food.\n"
        "Tips must include concrete eating instructions (how to enjoy the dish) in the output language.\n"
        "Output ONLY valid JSON (no markdown). Keys: schedule, cost_summary, external_places."
    )
    verify_human = (
        f"Target market: {market_name}\n"
        f"Narrative language for text fields: {lang_note}\n"
        "Walking only between stops; no subway/bus/taxi legs between items.\n"
        "Each place must plausibly be a real stall/shop inside this market (use search-backed real names when possible).\n\n"
        f"INPUT JSON:\n{json.dumps(data, ensure_ascii=False)}"
    )
    llm = _get_llm()
    response = await _invoke(
        llm,
        [SystemMessage(content=verify_system), HumanMessage(content=verify_human)],
        plain_fallback=True,
    )
    return _parse_json(response)


async def generate_cafe_tour_node(state: KContentState) -> KContentState:
    """KF_CAFE 전용: pickedVibe·keyword를 human 프롬프트에 넣어 Gemini(Search) 호출 후 schedule 형식으로 정규화."""
    user_profile: dict | None = state.get("user_profile")
    picked_vibe = _kf_cafe_picked_vibe(user_profile)
    keyword = _kf_cafe_user_keyword(user_profile)
    if not picked_vibe and not keyword:
        return {
            **state,
            "schedule": [],
            "cost_summary": None,
            "external_places": [],
            "places": state.get("db_places") or [],
            "error": "KF_CAFE: user_profile.pickedVibe 또는 keyword가 필요합니다.",
        }

    location_name = state.get("location_name") or state.get("location") or ""
    start_date = state.get("start_date")
    end_date = state.get("end_date")
    package_meta: dict = state.get("package_meta") or {}
    db_places: list[dict[str, Any]] = state.get("db_places") or []
    anchor_center = _extract_anchor_center(db_places)
    lang = _get_lang(user_profile)
    user_block = _build_user_profile_block(user_profile, lang=lang)
    date_list = _build_date_list(start_date, end_date)
    first_date = date_list[0] if date_list else (start_date or datetime.now().strftime("%Y-%m-%d"))
    date_clause = ""
    if date_list:
        num_days = len(date_list)
        mapping = " | ".join(f"Day{i + 1}:{d}" for i, d in enumerate(date_list))
        date_clause = f"Period:{start_date}~{end_date}({num_days}days) | DateMapping:{mapping}\n"

    anchor_center_line = (
        f"KF_CAFE | LocationHint:{location_name or 'Seoul'} | "
        "Geography: all itinerary stops within 100km straight-line from the geographic anchor "
        "(if the user named a specific cafe, anchor on that place via Search; if vibe-only, anchor on Seoul).\n"
    )

    system_prompt = _KF_CAFE_CURATOR_SYSTEM
    if lang != "Korean":
        system_prompt = (
            _KF_CAFE_CURATOR_SYSTEM
            + "\n\n⚠️ narrative fields inside Korean JSON values may stay Korean for place flavor; "
            f"if the user profile implies {lang}, you may blend as needed for vibe_reason/coord_context.\n"
        )

    prompt = (
        f"【picked_vibe (프론트 선택 Vibe ID)】\n{picked_vibe or '(미전달 — keyword·프로필만으로 taxonomy ID를 맞출 것)'}\n\n"
        f"【keyword (카페·장소 힌트 및 부가 설명)】\n{keyword or '(없음)'}\n\n"
        f"【API 기준 지역(location_name)】{location_name or 'Seoul'}\n"
        "(특정 카페가 keyword에 있으면 Search로 좌표를 확인해 그 점을 기준으로 100km 이내로 맞출 것)\n\n"
        f"【투어 시작일】{first_date}\n"
        f"{date_clause}"
        f"{anchor_center_line}\n"
        f"{user_block}"
        "정확히 3개 스톱(순서: 카페 → 편집샵·브랜드 스토어 → 다이닝/펍)인 **하루 코스**만 설계하세요. "
        "마지막 스톱은 Vibe Twist(반전) 규칙을 지키세요.\n"
        "응답은 시스템 메시지에 명시된 JSON 스키마의 **단일 객체**만 (마크다운·설명 문장 없이).\n"
    )

    llm = _get_llm_with_search()
    try:
        response = await _invoke(
            llm,
            [SystemMessage(content=system_prompt), HumanMessage(content=prompt)],
            plain_fallback=True,
        )
        data = _parse_json(response)
        pm = dict(package_meta)
        vc = data.get("vibe_category")
        tt = data.get("tour_theme")
        if vc:
            pm["vibe_category"] = vc
        if tt:
            pm["tour_theme"] = tt
        converted = _kf_cafe_itinerary_to_schedule(data, start_date=first_date, lang=lang)
        schedule_all = converted["schedule"]
        cost_summary = converted["cost_summary"]
        raw_ext = converted["external_places"]
        cafe_anchor = anchor_center or _KF_CAFE_DEFAULT_ANCHOR
        ext_filtered: list[KContentPlaceInfo] = []
        schedule: list[dict[str, Any]] = []
        for sch, item in zip(schedule_all, raw_ext):
            if item.get("lat") is not None and item.get("lng") is not None:
                if (
                    _haversine_km(
                        cafe_anchor[0],
                        cafe_anchor[1],
                        float(item["lat"]),
                        float(item["lng"]),
                    )
                    > 100.0
                ):
                    continue
            schedule.append(sch)
            ext_filtered.append(item)
        if len(schedule) < 3:
            return {
                **state,
                "package_meta": pm,
                "schedule": [],
                "cost_summary": None,
                "external_places": [],
                "places": state.get("db_places") or [],
                "error": "KF_CAFE: 모델이 유효하고 완전한 itinerary(3스톱)를 반환하지 않았거나, 좌표 기준 100km 밖 스톱만 포함되었습니다.",
            }
        places_out = (state.get("db_places") or []) + ext_filtered
        return {
            **state,
            "package_meta": pm,
            "schedule": schedule,
            "cost_summary": cost_summary,
            "external_places": ext_filtered,
            "places": places_out,
            "error": None,
        }
    except Exception as e:
        logger.exception("generate_cafe_tour_node 실패: %s", e)
        return {
            **state,
            "schedule": [],
            "cost_summary": None,
            "external_places": [],
            "places": state.get("db_places") or [],
            "error": str(e),
        }


async def generate_k_schedule_node(state: KContentState) -> KContentState:
    """노드 2: DB 핵심 앵커 + Gemini Search로 하이브리드 일정 생성."""
    location_name = state.get("location_name") or state.get("location") or ""
    start_date = state.get("start_date")
    end_date = state.get("end_date")
    user_profile: dict | None = state.get("user_profile")
    news_top10: list = state.get("news_top10") or []
    legacy_ref: str | None = state.get("legacy_package_ref")

    db_places: list[dict[str, Any]] = state.get("db_places") or []
    package_meta: dict = state.get("package_meta") or {}
    is_kf_market = _is_kf_market_mode(package_meta, legacy_ref)
    market_focus = _kf_market_focus_name(user_profile, location_name)

    if is_kf_market and not market_focus:
        return {
            **state,
            "schedule": [],
            "cost_summary": None,
            "external_places": [],
            "places": state.get("db_places") or [],
            "error": "KF_MARKET: location_name 또는 user_profile.keyword(선택 시장)이 필요합니다.",
        }

    anchor_center = _extract_anchor_center(db_places)
    anchor_center_line = ""
    if is_kf_market:
        anchor_center_line = (
            f"SelectedMarket:{market_focus} | "
            "MODE: KF_MARKET (traditional market food relay).\n"
            "Geography: ALL schedule places MUST stay inside this market's walkable boundary (≤1km from a typical in-market walking route).\n"
            "Transport between consecutive stops: WALKING ONLY. Ignore any generic 100km macro-radius rules.\n"
        )
    elif anchor_center:
        anchor_center_line = (
            f"ActivityCenter(lat,lng): ({anchor_center[0]:.5f}, {anchor_center[1]:.5f}) | "
            "External places must be within 100km radius from this center.\n"
        )
    theme_keywords = _extract_theme_keywords(package_meta)

    # Language / time slots
    lang = _get_lang(user_profile)
    lang_dir = _lang_directive(lang)
    if is_kf_market:
        time_labels = ["아침", "점심", "간식", "후식"] if lang == "Korean" else ["breakfast", "lunch", "snack", "dessert"]
    else:
        time_labels = ["오전", "점심", "오후", "저녁"] if lang == "Korean" else ["morning", "lunch", "afternoon", "evening"]

    date_list = _build_date_list(start_date, end_date)
    num_days = len(date_list) if date_list else _TRAVEL_DAYS_DEFAULT

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
    if is_kf_market:
        news_block = ""
    else:
        news_block = build_news_block_for_prompt(news_top10, location_name, for_k_content=True)

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

    if is_kf_market:
        system_prompt = (
            f"You are the dedicated tour guide for the Korean traditional market: {market_focus}.\n"
            "You MUST use Google Search to find REAL stall/shop names inside this market (exact Korean business names).\n"
            "If any itinerary item leaves the market boundary, the itinerary FAILS — do not output such items.\n"
            "Transportation between stops is WALKING ONLY (no subway, bus, taxi, or driving between items).\n"
            "Geographic constraint: all places must be inside the market walkable area (≤1km between adjacent stops along typical market alleys).\n"
            "Concept: a non-stop 'eating relay' through breakfast/lunch/snack/dessert slots inside the market.\n"
            "In tips, always include concrete eating tips (e.g., what to pair, order of eating, sharing style) in appetizing detail.\n"
            f"{korean_only_rule}"
        )
        prompt = (
            f"Market:{market_focus}\n"
            f"K-Content Package:{package_title} (KFOOD / KF_MARKET)\n"
            f"ThemeKeywords:{theme_keywords}\n"
            f"{anchor_center_line}"
            f"{date_clause}\n"
            f"\n【db_places】\n{anchors_lines and ''.join(anchors_lines) or '(empty — rely on search inside the market)'}\n"
            f"\nRaw db_places JSON:\n{db_places_json}\n\n"
            f"{user_block}"
            f"\nCreate a market-only food itinerary ({num_days} days, 4 items per day).\n\n"
            "Rules (KF_MARKET):\n"
            "- Every schedule item's place must be clearly INSIDE this market (stalls/shops/alley food stands).\n"
            "- Use Google Search to cite plausible real shop names for this market when possible.\n"
            "- Do NOT include attractions outside the market.\n"
            "- Walking only between consecutive items.\n"
            "- time_label must be exactly one of: "
            + ", ".join(time_labels)
            + "\n"
            "- tips: must include specific eating instructions (how to enjoy) for the market food at that stop.\n"
            "- description: explain why this stop fits the eating-relay flow inside the same market.\n"
            "- cost_summary.per_day and trip_total as KRW strings.\n"
            "- estimated_cost must be KRW string (e.g. '무료', '₩3,000', '₩15,000~₩20,000')\n"
            f"{lang_dir}\n\n"
            "Respond ONLY with valid JSON (no explanation):\n"
            "{"
            '"schedule":['
            '{"day":1,"date":"YYYY-MM-DD","time":"10:00","time_label":"아침","place":"실제 상호",'
            '"title":"활동","description":"설명","tips":"먹는 법·곁들임 등 구체 팁","estimated_cost":"₩0"}'
            "],"
            '"cost_summary":{"per_day":[{"day":1,"total":"₩0"}],"trip_total":"₩0"},'
            '"external_places":[{"name_en":"...","name_ko":"...","description_en":"...","must_do_en":"...","lat":37.5,"lng":127.0}]'
            "}"
        )
    else:
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
            "7) You have an activity center coordinate and a strict 100km radius boundary for external places.\n"
            "   You may cross administrative borders ONLY within this 100km macro-area.\n"
            "8) If a near-100km candidate is selected, self-check: is this destination truly worth the extra transfer time?\n"
            "   If not, reject it and choose a closer thematically-equivalent alternative for smoother routing.\n"
            f"{korean_only_rule}"
        )

        prompt = (
            f"Destination:{location_name}\n"
            f"K-Content Package:{package_title} ({package_meta.get('category','')})\n"
            f"ThemeKeywords:{theme_keywords}\n"
            f"{anchor_center_line}"
            f"{date_clause}\n"
            f"\n【db_places (core recommendation list, optional-by-route-efficiency)】\n"
            f"{anchors_lines and ''.join(anchors_lines) or '[]'}\n"
            f"\nRaw db_places JSON (for exact matching):\n{db_places_json}\n\n"
            f"{news_block}"
            f"{user_block}"
            f"\nCreate a detailed travel itinerary ({num_days} days, 4 items per day).\n\n"
            "Rules:\n"
            "- Use db_places as high-priority candidates, but do NOT force all of them.\n"
            "- Keep roughly 50-60% of schedule items from db_places (when feasible), and use external search results for the rest.\n"
            "- If a db_place is geographically inefficient, skip it and choose a better nearby alternative.\n"
            "- External places must align with the package title/category mood and fandom context, not generic tourist picks.\n"
            "- External places must stay within 100km radius from ActivityCenter.\n"
            "- Prefer context-aware exploration across neighboring cities/towns when they fit the same theme.\n"
            "- Crossing city/county boundaries is allowed only if still within 100km and route flow remains efficient.\n"
            "- For any far candidate near 100km boundary, keep it only when its thematic value clearly justifies transfer time.\n"
            "- In description/tips, naturally include why the place is geographically plausible and theme-consistent.\n"
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
            "{"
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
        response = await _invoke(
            llm,
            [SystemMessage(content=system_prompt), HumanMessage(content=prompt)],
            plain_fallback=True,
        )
        data = _parse_json(response)

        if is_kf_market:
            try:
                data = await _kf_market_review_schedule_json(data, market_name=market_focus, lang=lang)
            except Exception as rev_err:
                logger.warning("KF_MARKET review 단계 실패 — 1차 결과 사용: %s", rev_err)

        schedule = data.get("schedule", [])
        cost_summary = data.get("cost_summary")
        external_places_raw = data.get("external_places", []) or []

        max_km = 1.0 if is_kf_market else 100.0
        external_places: list[KContentPlaceInfo] = []
        for p in external_places_raw:
            item: KContentPlaceInfo = {
                "id": p.get("id"),  # optional
                "name_en": p.get("name_en") or "",
                "description_en": p.get("description_en"),
                "must_do_en": p.get("must_do_en"),
                "source": "external",
            }
            if isinstance(p.get("name_ko"), str) and p.get("name_ko"):
                item["name_ko"] = p.get("name_ko")
            # LLM이 lat/lng를 주지 않을 수 있으므로 있으면만 반영
            if p.get("lat") is not None:
                item["lat"] = float(p.get("lat"))
            if p.get("lng") is not None:
                item["lng"] = float(p.get("lng"))
            if (
                anchor_center
                and item.get("lat") is not None
                and item.get("lng") is not None
                and _haversine_km(anchor_center[0], anchor_center[1], float(item["lat"]), float(item["lng"])) > max_km
            ):
                continue
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
