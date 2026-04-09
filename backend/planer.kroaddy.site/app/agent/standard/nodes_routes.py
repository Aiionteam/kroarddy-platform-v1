"""Route-generation node."""
import logging
from time import perf_counter

from langchain_core.messages import HumanMessage

from app.agent.standard.nodes_common import (
    _format_festival_date,
    _get_lang,
    _get_llm,
    _invoke,
    _lang_directive,
    _parse_json,
)
from app.agent.standard.state import PlannerState
from app.services.news_client import build_news_block_for_prompt

logger = logging.getLogger(__name__)


async def generate_routes(state: PlannerState) -> PlannerState:
    t0 = perf_counter()
    location_name = state.get("location_name") or state["location"]
    festivals: list = state.get("festivals") or []
    user_profile: dict | None = state.get("user_profile")
    news_top10: list = state.get("news_top10") or []
    existing_routes: list = state.get("existing_routes") or []
    start_date = state.get("start_date")
    end_date = state.get("end_date")

    period_clause = f"여행 기간: {start_date} ~ {end_date}\n" if start_date and end_date else ""

    if festivals:
        lines: list[str] = []
        for f in festivals[:3]:
            name = f.get("fstvlNm", "")
            place = f.get("opar", "")
            s = _format_festival_date(f.get("fstvlStartDate", ""))
            e = _format_festival_date(f.get("fstvlEndDate", ""))
            content = f.get("fstvlCo", "")[:30]
            line = f"  • {name} ({place}, {s}~{e})"
            if content:
                line += f" – {content}"
            lines.append(line)
        festival_block = "【여행 기간 행사】\n" + "\n".join(lines) + "\n\n"
        festival_theme_desc = "1. 행사 중심: 위 행사를 핵심으로 구성. 행사명·개최 장소를 highlights에 반드시 포함하세요."
    else:
        festival_block = ""
        festival_theme_desc = "1. 행사/문화체험: 지역 대표 축제·전통 행사·문화 체험 위주 (현재 기간 행사 정보 없음, 대표적 문화행사로 대체)."

    lang = _get_lang(user_profile)
    lang_dir = _lang_directive(lang)
    news_block = build_news_block_for_prompt(news_top10, location_name, for_k_content=False, lang=lang)

    if existing_routes:
        quoted = ", ".join(f'"{r}"' for r in existing_routes)
        exclude_block = (
            f"【기존 루트(중복금지)】다음과 유사한 루트는 제외: {quoted}\n"
            "이름·highlights 구성 모두 달라야 함.\n\n"
        )
    else:
        exclude_block = ""

    if lang == "Korean":
        themes_desc = (
            f"1.{festival_theme_desc.split(':', 1)[-1].strip()}\n"
            "2.먹거리:재래시장·먹자골목·특산물 중심\n"
            "3.명소:대표관광지·문화재·자연경관\n"
            "4.럭셔리:고급숙소·파인다이닝·스파·전용투어\n"
            "5.가성비:무료명소·저렴먹거리·대중교통 중심\n"
            "6.가족:키즈체험·동물원·놀이공원·자연탐방(유아·초등 기준)\n"
            "7.커플:야경·사진스팟·감성카페·데이트코스\n"
        )
        schema_example = (
            '{"routes":[{"name":"루트명(≤15자)","theme":"행사|먹거리|명소|럭셔리|가성비|가족|커플",'
            '"description":"설명(≤40자)","highlights":["장소1","장소2","장소3"]}]}'
        )
        constraint_line = (
            f"⚠️ 지역 제한(CRITICAL): highlights의 모든 장소는 반드시 '{location_name}' 지역 내에 "
            "실제 존재해야 합니다. 이름이 비슷해도 다른 도시·지역 장소는 절대 포함 금지."
        )
        themes_intro = "아래 7가지 테마의 루트를 각 1개씩 순서대로 작성하세요:"
        highlights_rule = f"highlights는 {location_name} 내 실존 장소·거리·행사만 사용."
    else:
        fest_raw = festival_theme_desc.split(":", 1)[-1].strip()
        themes_desc = (
            f"1.event: {fest_raw}\n"
            "2.food: local markets, street food, regional specialties\n"
            "3.attractions: top landmarks, cultural heritage, nature\n"
            "4.luxury: upscale hotels, fine dining, spa, private tours\n"
            "5.budget: free attractions, affordable food, public transit\n"
            "6.family: kids activities, zoo, amusement park, nature trails\n"
            "7.couple: night views, photo spots, cafes, date courses\n"
        )
        schema_example = (
            '{"routes":[{"name":"route name(≤15chars)","theme":"event|food|attractions|luxury|budget|family|couple",'
            '"description":"description(≤40chars)","highlights":["place1","place2","place3"]}]}'
        )
        constraint_line = (
            f"⚠️ GEOGRAPHIC CONSTRAINT (CRITICAL): ALL highlights must be real places physically located within "
            f"'{location_name}'. Never use places from other cities even if names are similar."
        )
        themes_intro = "Generate exactly 7 routes (one per theme, in order):"
        highlights_rule = f"Use only real existing places in {location_name} for highlights."

    prompt = (
        f"Destination:{location_name} | {period_clause.strip()}\n"
        f"{constraint_line}\n\n"
        f"{exclude_block}{festival_block}{news_block}"
        f"{themes_intro}\n{themes_desc}\n{highlights_rule}\n{lang_dir}"
        "\nRespond ONLY with valid JSON (no explanation):\n"
        f"{schema_example}"
    )

    llm = _get_llm()
    try:
        response = await _invoke(llm, [HumanMessage(content=prompt)], plain_fallback=False)
        data = _parse_json(response)
        routes = data.get("routes", [])
        logger.info(
            "루트 생성 완료: %s개 (%s, 행사=%d, 뉴스=%d, 기존 제외=%d, %.2fs)",
            len(routes), location_name, len(festivals), len(news_top10), len(existing_routes), perf_counter() - t0,
        )
        return {**state, "routes": routes, "error": None}
    except Exception as e:
        logger.exception("루트 생성 실패: %s (%.2fs)", e, perf_counter() - t0)
        return {**state, "routes": [], "error": str(e)}
