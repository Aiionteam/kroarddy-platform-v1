"""Route-generation node — 외부 API 없이 순수 LLM 테마 생성."""
import logging
from time import perf_counter

from langchain_core.messages import HumanMessage

from app.agent.standard.nodes_common import (
    _get_lang,
    _get_llm,
    _invoke,
    _lang_directive,
    _parse_json,
)
from app.agent.standard.state import PlannerState

logger = logging.getLogger(__name__)

# 테마 한국어/영어 정의
_THEMES_KO = (
    "1.행사/문화체험: 지역 대표 축제·전통 행사·문화 체험 위주\n"
    "2.먹거리: 재래시장·먹자골목·특산물 중심\n"
    "3.명소: 대표관광지·문화재·자연경관\n"
    "4.럭셔리: 고급숙소·파인다이닝·스파·전용투어\n"
    "5.가성비: 무료명소·저렴먹거리·대중교통 중심\n"
    "6.가족: 키즈체험·동물원·놀이공원·자연탐방(유아·초등 기준)\n"
    "7.커플: 야경·사진스팟·감성카페·데이트코스\n"
)
_THEMES_EN = (
    "1.event: local festivals, cultural events, traditional experiences\n"
    "2.food: local markets, street food, regional specialties\n"
    "3.attractions: top landmarks, cultural heritage, nature\n"
    "4.luxury: upscale hotels, fine dining, spa, private tours\n"
    "5.budget: free attractions, affordable food, public transit\n"
    "6.family: kids activities, zoo, amusement park, nature trails\n"
    "7.couple: night views, photo spots, cafes, date courses\n"
)
_SCHEMA_KO = (
    '{"routes":[{"name":"루트명(≤15자)","theme":"행사|먹거리|명소|럭셔리|가성비|가족|커플",'
    '"description":"설명(≤40자)","highlights":["장소1","장소2","장소3"]}]}'
)
_SCHEMA_EN = (
    '{"routes":[{"name":"route name(≤15chars)","theme":"event|food|attractions|luxury|budget|family|couple",'
    '"description":"description(≤40chars)","highlights":["place1","place2","place3"]}]}'
)


async def generate_routes(state: PlannerState) -> PlannerState:
    """7개 테마 루트를 LLM으로 생성한다.

    외부 API(행사/뉴스/날씨) 호출 없이 순수 LLM만 사용해 응답 속도를 최소화한다.
    행사·뉴스 정보는 일정 생성(gather_context_node) 단계에서 반영된다.
    """
    t0 = perf_counter()
    location_name = state.get("location_name") or state["location"]
    logger.info(
        "[std_node] generate_routes 시작 location=%s (외부 API 없음, 행사/카카오는 일정 단계)",
        location_name,
    )
    existing_routes: list = state.get("existing_routes") or []
    user_profile: dict | None = state.get("user_profile")
    lang = _get_lang(user_profile)
    lang_dir = _lang_directive(lang)

    if existing_routes:
        quoted = ", ".join(f'"{r}"' for r in existing_routes[:15])
        if lang == "Korean":
            exclude_block = f"【중복 금지】다음과 유사한 루트는 제외: {quoted}\n이름·highlights 구성 모두 달라야 함.\n\n"
        else:
            exclude_block = f"【No duplicates】Exclude routes similar to: {quoted}\nNames and highlights must differ.\n\n"
    else:
        exclude_block = ""

    if lang == "Korean":
        constraint = (
            f"⚠️ 지역 제한(CRITICAL): highlights의 모든 장소는 반드시 '{location_name}' 지역 내에 "
            "실제 존재해야 합니다. 다른 도시·지역 장소 절대 포함 금지."
        )
        themes_intro = "아래 7가지 테마의 루트를 각 1개씩 순서대로 작성하세요:"
        themes_desc = _THEMES_KO
        schema = _SCHEMA_KO
    else:
        constraint = (
            f"⚠️ GEOGRAPHIC CONSTRAINT (CRITICAL): ALL highlights must be real places within "
            f"'{location_name}'. Never use places from other cities."
        )
        themes_intro = "Generate exactly 7 routes (one per theme, in order):"
        themes_desc = _THEMES_EN
        schema = _SCHEMA_EN

    prompt = (
        f"Destination: {location_name}\n"
        f"{constraint}\n\n"
        f"{exclude_block}"
        f"{themes_intro}\n{themes_desc}"
        f"{lang_dir}"
        "\nRespond ONLY with valid JSON (no explanation):\n"
        f"{schema}"
    )

    llm = _get_llm()
    try:
        response = await _invoke(llm, [HumanMessage(content=prompt)], plain_fallback=False)
        data = _parse_json(response)
        routes = data.get("routes", [])
        logger.info("루트 생성 완료: %d개 (%s, %.2fs)", len(routes), location_name, perf_counter() - t0)
        return {**state, "routes": routes, "error": None}
    except Exception as e:
        logger.exception("루트 생성 실패: %s (%.2fs)", e, perf_counter() - t0)
        return {**state, "routes": [], "error": str(e)}
