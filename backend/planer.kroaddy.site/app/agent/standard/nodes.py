"""LangGraph 노드 – Gemini로 루트/일정 생성 및 수정."""
import asyncio
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Any

from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.agent.standard.state import PlannerState
from app.core.config import settings

logger = logging.getLogger(__name__)

_TRAVEL_DAYS_DEFAULT = 2

# 일일 쿼터 초과 식별자 (재시도해도 무의미)
_DAILY_QUOTA_MARKER = "GenerateRequestsPerDayPerProjectPerModel"


def _get_llm() -> ChatGoogleGenerativeAI:
    """Gemini LLM 인스턴스 반환. max_output_tokens는 설정하지 않음.
    (langchain-google-genai 4.x에서 max_output_tokens 파라미터가
    실제보다 낮게 적용되어 JSON이 중간에 잘리는 버그가 있음)
    """
    return ChatGoogleGenerativeAI(
        model="gemini-3-flash-preview",
        temperature=0.4,
        google_api_key=settings.gemini_api_key,
    )


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
    return _DAILY_QUOTA_MARKER in str(err)


async def _invoke(llm: Any, messages: list, *, max_retries: int = 2) -> Any:
    """Gemini 호출 래퍼.

    - 일시적 429 (분당 제한): 지수 백오프 재시도 (최대 2회)
    - 일일 쿼터 초과: OpenAI gpt-4.1-mini 자동 폴백 (OPENAI_API_KEY 설정 시)
    """
    for attempt in range(max_retries + 1):
        try:
            return await llm.ainvoke(messages)
        except Exception as e:
            msg = str(e)

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
    """LLM 응답 content에서 텍스트 추출 (str 또는 list 모두 처리)."""
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


def _parse_json(raw: Any) -> dict:
    """LLM 응답에서 JSON 블록 추출."""
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


def _build_user_profile_block(profile: dict | None) -> str:
    """사용자 프로필 → 프롬프트 삽입 텍스트. 프로필이 없으면 빈 문자열."""
    if not profile:
        return ""

    gender = profile.get("gender") or "정보없음"
    age_band = profile.get("age_band") or "정보없음"
    dietary = profile.get("dietary_pref") or "일반"
    religion = profile.get("religion") or "없음"

    lines = [
        "【사용자 여행 성향 (루트 추천 참고)】",
        f"  • 성별: {gender}",
        f"  • 나이대: {age_band}",
        f"  • 식습관: {dietary}",
        f"  • 종교: {religion}",
        "",
    ]

    notes: list[str] = []
    if dietary in ("채식", "비건"):
        notes.append(f"- 먹거리 루트는 {dietary} 가능한 시장·음식 거리 위주로 구성하세요.")
    if dietary == "할랄":
        notes.append("- 먹거리 루트는 할랄 인증 음식 또는 무슬림 친화 식당가 위주로 구성하세요.")
    if religion == "이슬람":
        notes.append("- 돼지고기·주류 관련 장소는 피하고, 할랄 식당·무슬림 친화 명소를 우선하세요.")
    if religion == "불교":
        notes.append("- 사찰·불교문화 명소·템플스테이 등을 명소 루트에 적극 반영하세요.")
    if religion == "기독교":
        notes.append("- 성당·교회·기독교 역사 명소를 명소 루트에 포함할 수 있습니다.")

    if notes:
        lines.append("개인화 주의사항:")
        lines.extend(notes)
        lines.append("")

    return "\n".join(lines) + "\n"


async def generate_routes(state: PlannerState) -> PlannerState:
    """노드 1: 여행지 루트 7개 추천 (행사/먹거리/명소/럭셔리/가성비/가족/커플 테마)."""
    location_name = state.get("location_name") or state["location"]
    festivals: list = state.get("festivals") or []
    user_profile: dict | None = state.get("user_profile")
    existing_routes: list = state.get("existing_routes") or []
    start_date = state.get("start_date")
    end_date = state.get("end_date")

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

    user_block = _build_user_profile_block(user_profile)

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
        f"{user_block}{exclude_block}{festival_block}"
        "아래 7가지 테마의 루트를 각 1개씩 순서대로 작성하세요:\n"
        f"1.{festival_theme_desc.split(':',1)[-1].strip()}\n"
        "2.먹거리:재래시장·먹자골목·특산물 중심\n"
        "3.명소:대표관광지·문화재·자연경관\n"
        "4.럭셔리:고급숙소·파인다이닝·스파·전용투어\n"
        "5.가성비:무료명소·저렴먹거리·대중교통 중심\n"
        "6.가족:키즈체험·동물원·놀이공원·자연탐방(유아·초등 기준)\n"
        "7.커플:야경·사진스팟·감성카페·데이트코스\n\n"
        "highlights는 실존 장소·거리·행사만 사용.\n\n"
        "아래 JSON 형식으로만 응답하세요 (다른 설명 없이 JSON만):\n"
        '{"routes":[{"name":"이름(15자이내)","theme":"행사|먹거리|명소|럭셔리|가성비|가족|커플",'
        '"description":"설명(40자이내)","highlights":["장소1","장소2","장소3"]}]}'
    )

    llm = _get_llm()
    try:
        response = await _invoke(llm, [HumanMessage(content=prompt)])
        data = _parse_json(response.content)
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


async def generate_schedule(state: PlannerState) -> PlannerState:
    """노드 2: 선택된 루트의 상세 일정 생성."""
    location_name = state.get("location_name") or state["location"]
    route_name = state.get("route_name") or ""
    start_date = state.get("start_date")
    end_date = state.get("end_date")

    date_list = _build_date_list(start_date, end_date)
    num_days = len(date_list) if date_list else _TRAVEL_DAYS_DEFAULT
    date_example = date_list[0] if date_list else "YYYY-MM-DD"

    if date_list:
        mapping = " | ".join(f"Day{i+1}:{d}" for i, d in enumerate(date_list))
        date_clause = f"기간:{start_date}~{end_date}({num_days}일) | 날짜매핑:{mapping}\n"
    else:
        date_clause = ""

    prompt = (
        f"여행지:{location_name} | 루트:{route_name}\n"
        f"{date_clause}\n"
        f"상세 여행 일정을 작성하세요 ({num_days}일, 하루 4개 항목).\n\n"
        "규칙:\n"
        "- date 필드는 날짜매핑의 YYYY-MM-DD 형식을 그대로 사용\n"
        "- 실존하는 장소/음식점/관광지만 사용\n"
        "- time은 오전|점심|오후|저녁 중 하나\n\n"
        "아래 JSON 형식으로만 응답하세요 (다른 설명 없이 JSON만):\n"
        f'{{"schedule":[{{"day":1,"date":"{date_example}","time":"오전","place":"장소명",'
        '"title":"활동제목(20자이내)","description":"설명(60자이내)","tips":"팁(30자이내)"}]}}'
    )

    llm = _get_llm()
    try:
        response = await _invoke(llm, [HumanMessage(content=prompt)])
        data = _parse_json(response.content)
        schedule = data.get("schedule", [])
        logger.info(
            "일정 생성 완료: %s개 항목 (%s / %s)", len(schedule), location_name, route_name
        )
        return {**state, "schedule": schedule, "error": None}
    except Exception as e:
        logger.exception("일정 생성 실패: %s", e)
        return {**state, "schedule": [], "error": str(e)}


async def modify_schedule(
    schedule: list[dict[str, Any]],
    instruction: str,
    location: str,
) -> dict[str, Any]:
    """사용자 자연어 지시로 일정 특정 항목 수정.

    Returns:
        {"schedule": [...], "modified_titles": [...]}
    """
    schedule_json = json.dumps(schedule, ensure_ascii=False, separators=(",", ":"))
    prompt = (
        f'여행지:{location}\n'
        f'수정 지시:"{instruction}"\n'
        f"현재 일정(JSON):\n{schedule_json}\n\n"
        "규칙:\n"
        "- 지시된 항목만 place/title/description/tips 교체\n"
        "- day/date/time 및 나머지 항목은 절대 변경 금지\n"
        "- 실존하는 장소만 사용\n\n"
        "아래 JSON 형식으로만 응답하세요 (다른 설명 없이 JSON만):\n"
        '{"schedule":[{"day":1,"date":"YYYY-MM-DD","time":"오전","place":"장소명","title":"활동제목","description":"설명","tips":"팁"}],'
        '"modified_titles":["변경된항목의title"]}'
    )

    llm = _get_llm()
    try:
        response = await _invoke(llm, [HumanMessage(content=prompt)])
        data = _parse_json(response.content)
        logger.info("일정 수정 완료: %s", data.get("modified_titles", []))
        return {
            "schedule": data.get("schedule", schedule),
            "modified_titles": data.get("modified_titles", []),
        }
    except Exception as e:
        logger.exception("일정 수정 실패: %s", e)
        return {"schedule": schedule, "modified_titles": [], "error": str(e)}


async def reroll_single_item(
    item: dict[str, Any],
    schedule: list[dict[str, Any]],
    location: str,
) -> dict[str, Any]:
    """단일 일정 항목 리롤 – 해당 항목만 새로 생성.

    Returns:
        교체된 단일 아이템 dict
    """
    day = item.get("day", 1)
    date_str = item.get("date", "")
    time_str = item.get("time", "")

    same_day_titles = [
        s["title"] for s in schedule
        if s.get("day") == day and s.get("title") != item.get("title")
    ]
    ctx = f"같은날 다른일정(중복금지):{','.join(same_day_titles)}" if same_day_titles else ""

    prompt = (
        f"여행지:{location} | Day{day}({date_str}) {time_str}\n"
        f"교체 대상: {item.get('title')} (📍{item.get('place')})\n"
        f"{ctx}\n\n"
        "위 항목을 완전히 다른 장소/활동으로 교체하세요. day/date/time은 동일하게 유지.\n"
        "실존하는 장소만 사용하세요.\n\n"
        "아래 JSON 형식으로만 응답하세요 (다른 설명 없이 JSON만):\n"
        f'{{"day":{day},"date":"{date_str}","time":"{time_str}",'
        '"place":"장소명","title":"활동제목","description":"설명","tips":"팁"}'
        "}"
    )

    llm = _get_llm()
    try:
        response = await _invoke(llm, [HumanMessage(content=prompt)])
        new_item = _parse_json(response.content)
        logger.info("항목 리롤 완료: %s → %s", item.get("title"), new_item.get("title"))
        return new_item
    except Exception as e:
        logger.exception("항목 리롤 실패: %s", e)
        raise
