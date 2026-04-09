"""Standard 플래너 API 라우터 – 루트 추천 / 일정 생성 / 플랜 관리."""
import asyncio
import hashlib
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.agent.standard.graph import routes_graph, schedule_graph
from app.agent.standard.nodes import (
    _is_daily_quota,
    _geocode_item,
    _get_lang,
    _lang_directive,
    _build_user_profile_block,
    _build_festival_block,
    _build_transport_block,
    _generate_single_day,
    _build_date_list,
    _optimize_day_order,
    modify_schedule,
    reroll_single_item,
)
from app.services.news_client import build_news_block_for_prompt
from app.services.weather_client import build_weather_block_for_prompt
from app.core.config import settings
from app.core.database.session import get_db
from app.models.travel_plan import TravelPlan
from app.models.plan_cache import RouteCache, ScheduleCache
from app.services.festival_client import fetch_festivals_for_period
from app.services.news_client import fetch_news_top10
from app.services.naver_place_hours import enrich_schedule_items_with_hours
from app.services.user_info_client import fetch_user_profile
from app.services.weather_client import fetch_weather_for_planner
from .schemas import ModifyRequest, RerollItemRequest, RoutesRequest, SavePlanRequest, ScheduleRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/planner", tags=["standard"])


def _check_quota_error(e: Exception) -> None:
    """Gemini 에러를 사용자 친화적 HTTP 예외로 변환."""
    msg = str(e)

    # Semaphore 대기 타임아웃 → 503 (서버 과부하)
    if "AI 서버가 바쁩니다" in msg:
        raise HTTPException(status_code=503, detail=msg)

    if "429" not in msg and "RESOURCE_EXHAUSTED" not in msg:
        return
    if _is_daily_quota(e):
        raise HTTPException(
            status_code=429,
            detail="오늘의 AI 사용량이 초과됐습니다. 내일 다시 시도해 주세요. (무료 티어 일일 한도)",
        )
    raise HTTPException(
        status_code=429,
        detail="AI 요청이 잠시 몰렸습니다. 몇 초 후 다시 시도해 주세요.",
    )

def _existing_hash(existing_routes: list[str]) -> str:
    key = ",".join(sorted(existing_routes))
    return hashlib.md5(key.encode()).hexdigest()[:8]


# ─── L1 인메모리 캐시 ────────────────────────────────────────────
_routes_cache: dict[str, tuple[list, float]] = {}
_routes_lock: asyncio.Lock = asyncio.Lock()
_ROUTES_TTL = 3600

_schedule_cache: dict[str, tuple[list, float]] = {}
_schedule_lock: asyncio.Lock = asyncio.Lock()
_SCHEDULE_TTL = 7200

# ─── L2 DB 캐시 TTL ─────────────────────────────────────────────
_ROUTES_DB_TTL_DAYS = 5    # 루트: 5일 (장소/행사 변동 반영)
_SCHEDULE_DB_TTL_DAYS = 5  # 일정: 5일 (루트와 동일 주기)


def _now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


async def _get_routes_from_db(cache_key: str, db: AsyncSession) -> list | None:
    result = await db.execute(
        select(RouteCache).where(RouteCache.cache_key == cache_key)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    if row.expires_at.replace(tzinfo=timezone.utc) < _now_utc():
        await db.execute(delete(RouteCache).where(RouteCache.cache_key == cache_key))
        return None
    return row.routes


async def _save_routes_to_db(
    cache_key: str,
    location: str,
    routes: list,
    db: AsyncSession,
    *,
    lang_code: str | None = None,
    nationality: str | None = None,
) -> None:
    expires_at = _now_utc() + timedelta(days=_ROUTES_DB_TTL_DAYS)
    stmt = (
        pg_insert(RouteCache)
        .values(
            cache_key=cache_key,
            location=location,
            lang_code=lang_code,
            nationality=nationality,
            routes=routes,
            expires_at=expires_at,
        )
        .on_conflict_do_update(
            index_elements=["cache_key"],
            set_={"routes": routes, "expires_at": expires_at},
        )
    )
    await db.execute(stmt)


async def _get_schedule_from_db(cache_key: str, db: AsyncSession) -> list | None:
    result = await db.execute(
        select(ScheduleCache).where(ScheduleCache.cache_key == cache_key)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    if row.expires_at.replace(tzinfo=timezone.utc) < _now_utc():
        await db.execute(delete(ScheduleCache).where(ScheduleCache.cache_key == cache_key))
        return None
    return row.schedule


async def _save_schedule_to_db(
    cache_key: str,
    location: str,
    route_name: str,
    schedule: list,
    db: AsyncSession,
    *,
    lang_code: str | None = None,
    nationality: str | None = None,
) -> None:
    expires_at = _now_utc() + timedelta(days=_SCHEDULE_DB_TTL_DAYS)
    stmt = (
        pg_insert(ScheduleCache)
        .values(
            cache_key=cache_key,
            location=location,
            route_name=route_name,
            lang_code=lang_code,
            nationality=nationality,
            schedule=schedule,
            expires_at=expires_at,
        )
        .on_conflict_do_update(
            index_elements=["cache_key"],
            set_={"schedule": schedule, "expires_at": expires_at},
        )
    )
    await db.execute(stmt)


SLUG_TO_NAME: dict[str, str] = {
    # 특별시·광역시
    "seoul":         "서울",
    "busan":         "부산",
    "daegu":         "대구",
    "incheon":       "인천",
    "gwangju":       "광주",
    "daejeon":       "대전",
    "ulsan":         "울산",
    "sejong":        "세종",
    # 수도권 (경기도)
    "suwon":         "수원",
    "yongin":        "용인",
    "goyang":        "고양",
    "hwaseong":      "화성",
    "seongnam":      "성남",
    "bucheon":       "부천",
    "namyangju":     "남양주",
    "ansan":         "안산",
    "pyeongtaek":    "평택",
    "anyang":        "안양",
    "siheung":       "시흥",
    "paju":          "파주",
    "gimpo":         "김포",
    "uijeongbu":     "의정부",
    "gwangju-g":     "경기 광주",
    "hanam":         "하남",
    "gwangmyeong":   "광명",
    "gunpo":         "군포",
    "osan":          "오산",
    "yangju":        "양주",
    "icheon":        "이천",
    "guri":          "구리",
    "anseong":       "안성",
    "uiwang":        "의왕",
    "pocheon":       "포천",
    "yeoju":         "여주",
    "dongducheon":   "동두천",
    "gwacheon":      "과천",
    "gapyeong":      "가평",
    "yangpyeong":    "양평",
    # 강원권
    "chuncheon":     "춘천",
    "wonju":         "원주",
    "gangneung":     "강릉",
    "donghae":       "동해",
    "taebaek":       "태백",
    "sokcho":        "속초",
    "samcheok":      "삼척",
    "yangyang":      "양양",
    "pyeongchang":   "평창",
    "yeongwol":      "영월",
    "hoengseong":    "횡성",
    "jeongseon":     "정선",
    "inje":          "인제",
    "goseong-gw":    "고성(강원)",
    # 충청권
    "cheongju":      "청주",
    "chungju":       "충주",
    "jecheon":       "제천",
    "danyang":       "단양",
    "cheonan":       "천안",
    "gongju":        "공주",
    "boryeong":      "보령",
    "asan":          "아산",
    "seosan":        "서산",
    "nonsan":        "논산",
    "dangjin":       "당진",
    "taean":         "태안",
    "buyeo":         "부여",
    # 전라권
    "jeonju":        "전주",
    "gunsan":        "군산",
    "iksan":         "익산",
    "jeongeup":      "정읍",
    "namwon":        "남원",
    "gimje":         "김제",
    "gochang":       "고창",
    "mokpo":         "목포",
    "yeosu":         "여수",
    "suncheon":      "순천",
    "naju":          "나주",
    "gwangyang":     "광양",
    "damyang":       "담양",
    "boseong":       "보성",
    "wando":         "완도",
    "gangjin":       "강진",
    "yeonggwang":    "영광",
    "haenam":        "해남",
    "goheung":       "고흥",
    "yeongam":       "영암",
    # 경상권
    "pohang":        "포항",
    "gyeongju":      "경주",
    "gimcheon":      "김천",
    "andong":        "안동",
    "gumi":          "구미",
    "yeongju":       "영주",
    "yeongcheon":    "영천",
    "sangju":        "상주",
    "mungyeong":     "문경",
    "gyeongsan":     "경산",
    "changwon":      "창원",
    "jinju":         "진주",
    "tongyeong":     "통영",
    "sacheon":       "사천",
    "gimhae":        "김해",
    "miryang":       "밀양",
    "hadong":        "하동",
    "geochang":      "거창",
    "geoje":         "거제",
    "yangsan":       "양산",
    "namhae":        "남해",
    "hapcheon":      "합천",
    # 제주권
    "jeju":          "제주",
    "seogwipo":      "서귀포",
    # 경북 주요 관광지 (슬러그 확장)
    "palgongsan":    "팔공산",
    "gayasan":       "가야산",
    "juwangsan":     "주왕산",
    "nakdonggang":   "낙동강",
    # 전남 주요 관광지
    "jirisan":       "지리산",
    "hallyeohaesang": "한려해상",
    # 강원 주요 관광지
    "seoraksan":     "설악산",
    "odaesan":       "오대산",
    "chiaksan":      "치악산",
    # 충북
    "songnisan":     "속리산",
    "wolaksan":      "월악산",
    # 경기
    "bukhansan":     "북한산",
    "gwanaksan":     "관악산",
    # 제주
    "hallasan":      "한라산",
}


def _base_state(location: str, start_date: Optional[str], end_date: Optional[str]) -> dict:
    return {
        "location": location,
        "location_name": SLUG_TO_NAME.get(location, location),
        "route_name": None,
        "start_date": start_date,
        "end_date": end_date,
        "routes": [],
        "schedule": [],
        "cost_summary": None,
        "festivals": [],
        "user_profile": None,
        "existing_routes": [],
        "use_search": False,
        "news_top10": [],
        "weather_forecast": None,
        "transport_mode": None,
        "error": None,
    }


def _plan_to_dict(plan: TravelPlan) -> dict:
    return {
        "id": plan.id,
        "user_id": plan.user_id,
        "location": plan.location,
        "route_name": plan.route_name,
        "start_date": plan.start_date,
        "end_date": plan.end_date,
        "schedule": plan.schedule or [],
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
    }


@router.post("/{location}/routes", summary="여행 루트 7개 AI 추천 (행사/먹거리/명소/럭셔리/가성비|가족/커플)")
async def get_routes(location: str, req: RoutesRequest, db: AsyncSession = Depends(get_db)):
    location_name = SLUG_TO_NAME.get(location, location)
    existing_routes: list[str] = req.existing_routes or []
    eh = _existing_hash(existing_routes)
    # 루트 생성은 기본 Gemini 고정이므로 search_tag 불필요 → 캐시 키 단순화
    transport_tag = req.transport_mode or "any"

    # ── user_profile을 먼저 조회해야 lang_code가 확정되고
    #    캐시 키를 올바르게 만들 수 있다.
    #    _preliminary_key(lang 없음)로 먼저 읽고 cache_key(lang 있음)로 저장하는
    #    구조는 키 불일치로 캐시 히트가 영원히 발생하지 않고
    #    다른 국적 사용자에게 잘못된 언어의 루트를 반환하는 버그가 있다.
    user_profile = await fetch_user_profile(req.user_id)
    nationality = (user_profile or {}).get("nationality", "")
    lang_code = nationality[:3].lower() if nationality else "ko"
    cache_key = f"{location}:{req.start_date}:{req.end_date}:{eh}:{lang_code}:{transport_tag}"

    cached = _routes_cache.get(cache_key)
    if cached and time.time() - cached[1] < _ROUTES_TTL:
        logger.info("루트 L1캐시 히트: %s (lang=%s)", cache_key, lang_code)
        return {"location": location, "location_name": location_name, "routes": cached[0]}

    async with _routes_lock:
        cached = _routes_cache.get(cache_key)
        if cached and time.time() - cached[1] < _ROUTES_TTL:
            logger.info("루트 L1캐시 히트(lock 내부): %s", cache_key)
            return {"location": location, "location_name": location_name, "routes": cached[0]}

        # DB 캐시도 lang 포함된 cache_key로 조회
        db_routes = await _get_routes_from_db(cache_key, db)
        if db_routes:
            _routes_cache[cache_key] = (db_routes, time.time())
            logger.info("루트 L2(DB)캐시 히트: %s (%d건)", cache_key, len(db_routes))
            return {"location": location, "location_name": location_name, "routes": db_routes}

        # 루트 생성: 행사 정보만 조회 (뉴스·날씨는 프롬프트에 포함하지 않으므로 건너뜀 → 속도 개선)
        festivals = await fetch_festivals_for_period(location, location_name, req.start_date, req.end_date)

        logger.info(
            "루트 생성 연동: location=%s, 행사=%d건 | 유저 프로필: %s (국적=%s, lang=%s) | 기존 제외=%d건 | 이동수단=%s",
            location, len(festivals),
            bool(user_profile), nationality, lang_code, len(existing_routes),
            transport_tag,
        )

        state = {
            **_base_state(location, req.start_date, req.end_date),
            "festivals": festivals,
            "user_profile": user_profile,
            "existing_routes": existing_routes,
            "transport_mode": req.transport_mode,
        }
        try:
            result = await routes_graph.ainvoke(state)
        except Exception as e:
            _check_quota_error(e)
            raise
        if result.get("error") and not result.get("routes"):
            _check_quota_error(Exception(result["error"]))
            return {
                "location": location,
                "location_name": location_name,
                "routes": [],
                "error": result["error"],
            }

        routes = result["routes"]
        _routes_cache[cache_key] = (routes, time.time())
        try:
            await _save_routes_to_db(
                cache_key, location_name, routes, db,
                lang_code=lang_code, nationality=nationality,
            )
        except Exception as e:
            logger.warning("루트 DB캐시 저장 실패 (무시): %s", e)
        logger.info("루트 캐시 저장(L1+L2): %s (%d건, lang=%s)", cache_key, len(routes), lang_code)
        return {"location": location, "location_name": location_name, "routes": routes}


@router.post("/{location}/schedule", summary="선택 루트 AI 일정 생성 (저장 없음)")
async def get_schedule(location: str, req: ScheduleRequest, db: AsyncSession = Depends(get_db)):
    location_name = SLUG_TO_NAME.get(location, location)

    # user_profile 조회 (언어 결정 및 개인화용)
    user_profile = await fetch_user_profile(req.user_id)
    nationality = (user_profile or {}).get("nationality", "")
    lang_code = nationality[:3].lower() if nationality else "ko"
    sched_transport_tag = req.transport_mode or "any"
    # 일정은 항상 Search grounding 사용하므로 search_tag 불필요
    sched_key = f"{location}:{req.route_name}:{req.start_date}:{req.end_date}:{lang_code}:{sched_transport_tag}"

    cached_sched = _schedule_cache.get(sched_key)
    if cached_sched and time.time() - cached_sched[1] < _SCHEDULE_TTL:
        logger.info("일정 L1캐시 히트: %s", sched_key)
        return {
            "location": location,
            "location_name": location_name,
            "route_name": req.route_name,
            "schedule": cached_sched[0],
            "error": None,
        }

    async with _schedule_lock:
        cached_sched = _schedule_cache.get(sched_key)
        if cached_sched and time.time() - cached_sched[1] < _SCHEDULE_TTL:
            logger.info("일정 L1캐시 히트(lock 내부): %s", sched_key)
            return {
                "location": location,
                "location_name": location_name,
                "route_name": req.route_name,
                "schedule": cached_sched[0],
                "error": None,
            }

        db_schedule = await _get_schedule_from_db(sched_key, db)
        if db_schedule:
            _schedule_cache[sched_key] = (db_schedule, time.time())
            logger.info("일정 L2(DB)캐시 히트: %s (%d항목)", sched_key, len(db_schedule))
            return {
                "location": location,
                "location_name": location_name,
                "route_name": req.route_name,
                "schedule": db_schedule,
                "error": None,
            }

        # 일정 생성에도 행사·뉴스·날씨 정보 반영
        # 뉴스 Top10: 프론트에서 이미 가져온 데이터가 있으면 재사용
        _has_client_news_s = bool(req.news_top10)
        festivals, news_top10, weather_forecast_s = await asyncio.gather(
            fetch_festivals_for_period(location, location_name, req.start_date, req.end_date),
            asyncio.sleep(0) if _has_client_news_s else fetch_news_top10(req.start_date, req.end_date),
            fetch_weather_for_planner(location_name, None, req.start_date, req.end_date),
        )
        if _has_client_news_s:
            news_top10 = req.news_top10  # type: ignore[assignment]

        logger.info(
            "일정 생성 연동: location=%s, 행사=%d건, 뉴스Top10=%d건(%s), 날씨=%s, 이동수단=%s",
            location, len(festivals), len(news_top10 or []),
            "client" if _has_client_news_s else "fetched",
            "available" if (weather_forecast_s or {}).get("available") else "unavailable",
            sched_transport_tag,
        )

        state = {
            **_base_state(location, req.start_date, req.end_date),
            "route_name": req.route_name,
            "user_profile": user_profile,
            "festivals": festivals,
            "news_top10": news_top10,
            "weather_forecast": weather_forecast_s,
            "transport_mode": req.transport_mode,
        }
        try:
            result = await schedule_graph.ainvoke(state)
        except Exception as e:
            _check_quota_error(e)
            raise
        schedule = result.get("schedule", [])

        if schedule:
            _schedule_cache[sched_key] = (schedule, time.time())
            try:
                await _save_schedule_to_db(
                    sched_key, location_name, req.route_name, schedule, db,
                    lang_code=lang_code, nationality=nationality,
                )
            except Exception as e:
                logger.warning("일정 DB캐시 저장 실패 (무시): %s", e)
            logger.info("일정 캐시 저장(L1+L2): %s (%d항목, lang=%s)", sched_key, len(schedule), lang_code)

        return {
            "location": location,
            "location_name": location_name,
            "route_name": req.route_name,
            "schedule": schedule,
            "cost_summary": result.get("cost_summary"),
            "error": result.get("error"),
        }


@router.post(
    "/{location}/schedule/stream",
    summary="SSE 스트리밍 일정 생성 – Day별 생성 즉시 전송",
)
async def stream_schedule(
    location: str,
    req: ScheduleRequest,
    db: AsyncSession = Depends(get_db),
):
    """일정을 Day별로 병렬 생성하고, 완료된 Day부터 즉시 SSE로 전송합니다.

    이벤트 타입:
    - status   : {"type":"status","message":"..."}
    - day      : {"type":"day","items":[...],"cost":{...}}
    - geocoded : {"type":"geocoded","items":[...]}
    - cost_summary: {"type":"cost_summary","data":{...}}
    - error    : {"type":"error","message":"..."}
    - done     : {"type":"done"}
    - cached   : {"type":"cached","schedule":[...],"cost_summary":{...}}
    """
    location_name = SLUG_TO_NAME.get(location, location)
    user_profile = await fetch_user_profile(req.user_id)
    nationality = (user_profile or {}).get("nationality", "")
    lang_code = nationality[:3].lower() if nationality else "ko"
    transport_tag = req.transport_mode or "any"
    # 일정은 항상 Search grounding 사용하므로 search_tag 불필요
    sched_key = (
        f"{location}:{req.route_name}:{req.start_date}:{req.end_date}"
        f":{lang_code}:{transport_tag}"
    )

    def _sse(obj: dict) -> str:
        return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"

    async def generate():
        # ── L1 캐시 히트 ────────────────────────────────────────────
        cached_sched = _schedule_cache.get(sched_key)
        if cached_sched and time.time() - cached_sched[1] < _SCHEDULE_TTL:
            items, cost = cached_sched
            yield _sse({"type": "cached", "schedule": items, "cost_summary": cost})
            yield _sse({"type": "done"})
            return

        # ── L2 DB 캐시 히트 ─────────────────────────────────────────
        db_schedule = await _get_schedule_from_db(sched_key, db)
        if db_schedule:
            _schedule_cache[sched_key] = (db_schedule, time.time())
            yield _sse({"type": "cached", "schedule": db_schedule, "cost_summary": None})
            yield _sse({"type": "done"})
            return

        # ── 행사·뉴스·날씨 병렬 수집 ────────────────────────────────
        yield _sse({"type": "status", "message": "행사·날씨 정보 수집 중…"})
        _has_client_news = bool(req.news_top10)
        try:
            festivals, news_top10, weather_forecast = await asyncio.gather(
                fetch_festivals_for_period(location, location_name, req.start_date, req.end_date),
                asyncio.sleep(0) if _has_client_news else fetch_news_top10(req.start_date, req.end_date),
                fetch_weather_for_planner(location_name, None, req.start_date, req.end_date),
            )
        except Exception as e:
            yield _sse({"type": "error", "message": f"사전 데이터 수집 실패: {e}"})
            yield _sse({"type": "done"})
            return
        if _has_client_news:
            news_top10 = req.news_top10  # type: ignore[assignment]

        # ── 날짜 목록 ────────────────────────────────────────────────
        date_list = _build_date_list(req.start_date, req.end_date)
        if not date_list:
            yield _sse({"type": "error", "message": "날짜 정보가 필요합니다."})
            yield _sse({"type": "done"})
            return

        # ── LLM 프롬프트 블록 ────────────────────────────────────────
        lang = _get_lang(user_profile)
        lang_dir = _lang_directive(lang)
        user_block = _build_user_profile_block(user_profile, lang)
        news_block = build_news_block_for_prompt(news_top10 or [], location_name, for_k_content=False, lang=lang)
        weather_block = build_weather_block_for_prompt(weather_forecast or {}, req.start_date, req.end_date)
        transport_block = _build_transport_block(req.transport_mode or "")
        festival_block = _build_festival_block(festivals or [], lang=lang)

        num_days = len(date_list)
        common_kwargs = dict(
            num_days=num_days,
            location_name=location_name,
            route_name=req.route_name,
            lang=lang,
            lang_dir=lang_dir,
            user_block=user_block,
            festival_block=festival_block,
            weather_block=weather_block,
            transport_block=transport_block,
            news_block=news_block,
        )

        # ── Day별 병렬 생성 → 완료된 Day 즉시 스트리밍 + 즉시 Geocoding 시작 ──
        # Day N이 완료되는 즉시 해당 Day의 geocoding을 비동기로 시작한다.
        # Day N+1, N+2 LLM 응답 대기 시간과 geocoding이 겹쳐(overlap)
        # 전체 지연 시간이 max(LLM_day) + geocode_per_day 수준으로 단축된다.
        yield _sse({"type": "status", "message": f"AI가 {num_days}일 일정 생성 중…"})

        llm_futures = {
            asyncio.ensure_future(
                _generate_single_day(day_num=i + 1, date_str=date_str, **common_kwargs)
            ): i + 1
            for i, date_str in enumerate(date_list)
        }

        all_items: list[dict] = []
        per_day_costs: list[dict] = []
        # (순서 인덱스, geocode Future) 쌍 – 나중에 순서대로 수집
        geocode_futures: list[tuple[int, "asyncio.Future[list[dict]]"]] = []
        pending = set(llm_futures.keys())
        item_offset = 0  # geocode 결과와 all_items 항목을 연결하는 오프셋

        while pending:
            done_set, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
            for fut in done_set:
                try:
                    items, per_day_cost = fut.result()
                    all_items.extend(items)
                    per_day_costs.append(per_day_cost)
                    yield _sse({
                        "type": "day",
                        "items": items,
                        "cost": per_day_cost,
                    })
                    # Day LLM 완료 즉시 해당 Day의 geocoding 시작
                    geo_fut = asyncio.ensure_future(
                        asyncio.gather(*[_geocode_item(it) for it in items], return_exceptions=True)
                    )
                    geocode_futures.append((item_offset, geo_fut))
                    item_offset += len(items)
                except Exception as e:
                    logger.error("스트리밍 Day 생성 실패: %s", e)
                    yield _sse({"type": "error", "message": str(e)})

        if not all_items:
            yield _sse({"type": "done"})
            return

        # ── 좌표 검증 결과 수집 + 경로 최적화 ───────────────────────
        # 이미 대부분의 geocoding이 백그라운드에서 완료됐을 가능성이 높음
        yield _sse({"type": "status", "message": "좌표 검증 중…"})
        geocoded = list(all_items)  # 원본 복사 (실패 시 fallback)
        try:
            for offset, geo_fut in geocode_futures:
                results = await geo_fut
                for i, res in enumerate(results):
                    if isinstance(res, dict):
                        geocoded[offset + i] = res
                    # 예외이면 원본 유지 (이미 복사됨)
        except Exception as e:
            logger.warning("지오코딩 결과 수집 실패(스트리밍), 원본 유지: %s", e)

        # 일별 Nearest-Neighbor 경로 최적화
        days_map: dict[int, list] = {}
        for item in geocoded:
            days_map.setdefault(item.get("day", 1), []).append(item)
        optimized: list[dict] = []
        for day_num in sorted(days_map.keys()):
            optimized.extend(_optimize_day_order(days_map[day_num]))

        yield _sse({"type": "geocoded", "items": optimized})

        # ── 비용 요약 ────────────────────────────────────────────────
        per_day_costs.sort(key=lambda x: x.get("day", 0))
        total_krw = sum(c.get("total_krw", 0) for c in per_day_costs)
        cost_summary = {
            "per_day": [{"day": c["day"], "total": c["total"]} for c in per_day_costs],
            "trip_total": f"₩{total_krw:,}" if total_krw else "N/A",
        }
        yield _sse({"type": "cost_summary", "data": cost_summary})

        # ── 캐시 저장 ────────────────────────────────────────────────
        _schedule_cache[sched_key] = (optimized, time.time())
        try:
            await _save_schedule_to_db(
                sched_key, location_name, req.route_name, optimized, db,
                lang_code=lang_code, nationality=nationality,
            )
        except Exception as e:
            logger.warning("스트리밍 일정 DB캐시 저장 실패(무시): %s", e)

        yield _sse({"type": "done"})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # nginx 버퍼링 비활성화
        },
    )


@router.post("/plans", summary="여행 플랜 저장")
async def save_plan(req: SavePlanRequest, db: AsyncSession = Depends(get_db)):
    location_name = SLUG_TO_NAME.get(req.location, req.location)
    schedule = req.schedule
    if settings.naver_place_hours_enabled and schedule:
        try:
            schedule = await enrich_schedule_items_with_hours(schedule)
        except Exception as e:
            logger.warning("저장 전 영업시간 보강 실패(무시): %s", e)

    plan = TravelPlan(
        user_id=req.user_id,
        location=location_name,
        route_name=req.route_name,
        start_date=req.start_date,
        end_date=req.end_date,
        schedule=schedule,
    )
    db.add(plan)
    await db.flush()
    logger.info("플랜 저장: id=%s user=%s location=%s", plan.id, req.user_id, location_name)
    return {"plan_id": plan.id, "location": req.location, "location_name": location_name}


@router.patch("/plans/{plan_id}/modify", summary="AI로 일정 특정 항목 수정")
async def modify_plan(
    plan_id: int,
    req: ModifyRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TravelPlan).where(TravelPlan.id == plan_id, TravelPlan.user_id == req.user_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="플랜을 찾을 수 없거나 수정 권한이 없습니다.")

    user_profile = await fetch_user_profile(req.user_id)
    try:
        modified = await modify_schedule(plan.schedule or [], req.instruction, plan.location, user_profile)
    except Exception as e:
        _check_quota_error(e)
        raise

    not_possible: bool = modified.get("not_possible", False)
    reason: str = modified.get("reason", "")
    new_schedule = modified.get("schedule", plan.schedule)

    # 불가능한 경우 일정 변경 없이 이유만 반환
    if not not_possible:
        # 수정된 항목만 지오코딩 보강 (나머지는 기존 좌표 유지)
        modified_titles = set(modified.get("modified_titles", []))

        async def _maybe_geocode(item: dict) -> dict:
            return await _geocode_item(item) if item.get("title") in modified_titles else item

        geocoded_schedule = list(await asyncio.gather(*[_maybe_geocode(item) for item in new_schedule]))
        plan.schedule = geocoded_schedule
        flag_modified(plan, "schedule")
        await db.flush()
        new_schedule = geocoded_schedule

    return {
        "plan_id": plan_id,
        "schedule": new_schedule,
        "modified_titles": modified.get("modified_titles", []),
        "not_possible": not_possible,
        "reason": reason,
        "error": modified.get("error"),
    }


@router.post("/plans/{plan_id}/items/reroll", summary="단일 일정 항목 리롤 (해당 항목만 새로 생성)")
async def reroll_item(
    plan_id: int,
    req: RerollItemRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TravelPlan).where(TravelPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="플랜을 찾을 수 없습니다.")

    schedule: list = plan.schedule or []
    if req.item_index < 0 or req.item_index >= len(schedule):
        raise HTTPException(status_code=400, detail=f"item_index {req.item_index}가 범위를 벗어납니다 (총 {len(schedule)}개).")

    target_item = schedule[req.item_index]
    location_name = plan.location
    user_profile = await fetch_user_profile(req.user_id)

    try:
        new_item = await reroll_single_item(target_item, schedule, location_name, user_profile)
    except Exception as e:
        _check_quota_error(e)
        raise HTTPException(status_code=500, detail=f"리롤 실패: {e}")

    # 새 항목 지오코딩 보강
    new_item = await _geocode_item(new_item)
    if settings.naver_place_hours_enabled:
        try:
            enriched_one = await enrich_schedule_items_with_hours([new_item])
            if enriched_one:
                new_item = enriched_one[0]
        except Exception as e:
            logger.warning("리롤 항목 영업시간 보강 실패(무시): %s", e)

    new_schedule = list(schedule)
    new_schedule[req.item_index] = new_item
    plan.schedule = new_schedule
    flag_modified(plan, "schedule")
    await db.flush()

    logger.info("항목 리롤 저장: plan_id=%s idx=%s", plan_id, req.item_index)
    return {
        "plan_id": plan_id,
        "item_index": req.item_index,
        "new_item": new_item,
        "schedule": new_schedule,
    }


@router.get("/plans", summary="사용자의 저장된 플랜 목록")
async def get_my_plans(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TravelPlan)
        .where(TravelPlan.user_id == user_id)
        .order_by(TravelPlan.created_at.desc())
    )
    plans = result.scalars().all()
    return {"plans": [_plan_to_dict(p) for p in plans]}


@router.delete("/plans/{plan_id}", summary="저장된 플랜 삭제")
async def delete_plan(plan_id: int, user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TravelPlan).where(TravelPlan.id == plan_id, TravelPlan.user_id == user_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="플랜을 찾을 수 없거나 삭제 권한이 없습니다.")
    await db.delete(plan)
    await db.flush()
    return {"deleted": True, "plan_id": plan_id}
