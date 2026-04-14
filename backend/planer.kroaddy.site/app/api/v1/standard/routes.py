"""Standard 플래너 API 라우터 – 루트 추천 / 일정 생성 / 플랜 관리."""
import asyncio
import hashlib
import json
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.agent.standard import graph as std_graph
from app.agent.standard.graph_checkpoint import schedule_checkpoint_active
from app.agent.standard.nodes_common import (
    _build_transport_block,
    _build_user_profile_block,
    _get_lang,
    _is_daily_quota,
    _lang_directive,
    _optimize_day_order,
    modify_schedule,
    reroll_single_item,
)
from app.agent.standard.nodes_schedule import (
    _build_date_list,
    _build_festival_block,
    _format_naver_tips_block,
    _format_web_search_block,
    _gather_web_search_context,
    _generate_single_day,
    _geocode_item,
    _venue_dedupe_key,
    gather_context_node,
)
from app.services.news_client import build_news_block_for_prompt
from app.services.weather_client import build_weather_block_for_prompt
from app.core.config import settings
from app.core.database.session import _get_async_session_factory, get_db
from app.models.travel_plan import TravelPlan
from app.models.plan_cache import RouteCache, ScheduleCache
from app.services.naver_place_hours import enrich_schedule_items_with_hours
from app.services.user_info_client import fetch_user_profile
from app.services.upstash_redis import (
    upstash_cache_configured,
    upstash_delete,
    upstash_get_str,
    upstash_setex_str,
)
from .schemas import ModifyRequest, RerollItemRequest, RoutesRequest, SavePlanRequest, ScheduleRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/planner", tags=["standard"])

# ── 일정 스트림 gather 맥락(Upstash REST) ───────────────────────────────────
_STREAM_CTX_VER = 2
_STREAM_GATHER_KEYS = (
    "festivals",
    "news_top10",
    "weather_forecast",
    "web_search_context",
    "web_search_gather_attempted",
    "naver_tips_context",
    "naver_tips_gather_attempted",
    "kakao_poi_context_block",
)


def _schedule_thread_id(req: ScheduleRequest) -> str:
    t = (req.thread_id or "").strip()
    if t:
        return t[:220]
    return secrets.token_urlsafe(20)


def _stream_gather_ctx_cache_key(thread_id: str) -> str:
    h = hashlib.sha256(thread_id.encode("utf-8")).hexdigest()[:48]
    return f"planer:std:stream:gctx:{h}"


def _pack_stream_gather_fields(ctx_state: dict) -> dict:
    return {k: ctx_state.get(k) for k in _STREAM_GATHER_KEYS}


def _apply_stream_gather_fields(target: dict, saved: dict) -> None:
    for k in _STREAM_GATHER_KEYS:
        if k in saved:
            target[k] = saved[k]


async def _try_load_stream_gather_snapshot(thread_id: str, sched_key: str) -> dict | None:
    if not upstash_cache_configured():
        return None
    raw = await upstash_get_str(_stream_gather_ctx_cache_key(thread_id))
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if data.get("v") != _STREAM_CTX_VER or data.get("sched_key") != sched_key:
        return None
    ctx = data.get("ctx")
    return ctx if isinstance(ctx, dict) else None


async def _save_stream_gather_snapshot(thread_id: str, sched_key: str, ctx_state: dict) -> None:
    if not upstash_cache_configured():
        return
    payload = {
        "v": _STREAM_CTX_VER,
        "sched_key": sched_key,
        "ctx": _pack_stream_gather_fields(ctx_state),
    }
    ttl = max(120, min(int(settings.redis_stream_gather_ttl_sec), 86400 * 2))
    try:
        body = json.dumps(payload, ensure_ascii=False, default=str)
    except TypeError as e:
        logger.warning("스트림 gather 스냅샷 직렬화 실패: %s", e)
        return
    await upstash_setex_str(_stream_gather_ctx_cache_key(thread_id), ttl, body)


async def _clear_stream_gather_snapshot(thread_id: str) -> None:
    await upstash_delete(_stream_gather_ctx_cache_key(thread_id))


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


def _stream_schedule_error_message(e: Exception) -> str:
    """SSE error 이벤트용 짧은 메시지 (HTTP 500 대신 클라이언트에 전달)."""
    msg = str(e)
    if "AI 서버가 바쁩니다" in msg:
        return "AI 서버가 잠시 과부하 상태입니다. 잠시 후 다시 시도해 주세요."
    if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
        if _is_daily_quota(e):
            return "오늘의 AI 사용량이 초과됐습니다. 내일 다시 시도해 주세요."
        return "AI 요청이 잠시 몰렸습니다. 잠시 후 다시 시도해 주세요."
    if "Timeout" in type(e).__name__ or "timeout" in msg.lower():
        return "일정 생성이 시간 초과로 중단되었습니다. 다시 시도하거나 검색 옵션을 끄고 시도해 보세요."
    return (msg[:800] + "…") if len(msg) > 800 else msg


# 긴 LLM·웹수집 구간에서 SSE 청크가 없으면 nginx 등 proxy_read_timeout(기본 60s)으로 연결이 끊길 수 있음
_SSE_STREAM_KEEPALIVE_SEC = 15.0


async def _sse_keepalive_while(
    task: asyncio.Task,
    *,
    interval: float = _SSE_STREAM_KEEPALIVE_SEC,
):
    """task가 끝날 때까지 interval마다 SSE comment 줄을 낸다 (클라이언트는 무시, 프록시만 유지)."""
    while True:
        if task.done():
            return
        try:
            await asyncio.wait_for(asyncio.shield(task), timeout=interval)
            return
        except asyncio.TimeoutError:
            yield ": \n\n"


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

# ─── 비동기 일정 job (Upstash 없으면 프로세스 메모리, 멀티 워커에서는 Redis 권장) ─
_ASYNC_JOB_KEY_PREFIX = "planer:std:async_job:"
_ASYNC_JOB_TTL_SEC = 7200
_async_jobs_mem: dict[str, dict] = {}
_async_jobs_lock = asyncio.Lock()


def _async_job_redis_key(job_id: str) -> str:
    return f"{_ASYNC_JOB_KEY_PREFIX}{job_id}"


async def _async_job_put(job_id: str, payload: dict) -> None:
    """job 상태 저장 (완료 시 result에 동기 엔드포인트와 동일 형태의 필드 포함)."""
    data = {**payload, "updated_at": time.time()}
    raw = json.dumps(data, ensure_ascii=False, default=str)
    if upstash_cache_configured():
        await upstash_setex_str(_async_job_redis_key(job_id), _ASYNC_JOB_TTL_SEC, raw)
    else:
        async with _async_jobs_lock:
            _async_jobs_mem[job_id] = data


async def _async_job_get(job_id: str) -> dict | None:
    if upstash_cache_configured():
        s = await upstash_get_str(_async_job_redis_key(job_id))
        if not s:
            return None
        try:
            return json.loads(s)
        except json.JSONDecodeError:
            return None
    async with _async_jobs_lock:
        return _async_jobs_mem.get(job_id)


async def _generate_schedule_after_cache_miss(
    location: str,
    location_name: str,
    req: ScheduleRequest,
    user_profile: dict | None,
    lang_code: str,
    nationality: str,
    sched_key: str,
    search_tag: str,
    db: AsyncSession,
) -> dict:
    """L1/L2 미스 후 LangGraph 일정 생성·캐시 저장. ``_schedule_lock`` 보유 중 호출."""
    logger.info("일정 생성 시작: %s/%s (lang=%s, search=%s)", location, req.route_name, lang_code, search_tag)
    run_thread_id = _schedule_thread_id(req)
    state = {
        **_base_state(location, req.start_date, req.end_date),
        "user_id": req.user_id,
        "user_profile": user_profile,
        "news_top10": req.news_top10 or [],
        "route_name": req.route_name,
        "transport_mode": req.transport_mode,
        "use_search": req.use_search,
    }
    try:
        if schedule_checkpoint_active():
            result = await std_graph.schedule_graph.ainvoke(
                state,
                {"configurable": {"thread_id": run_thread_id}},
            )
        else:
            result = await std_graph.schedule_graph.ainvoke(state)
    except Exception as e:
        await db.rollback()
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
            await db.rollback()
        logger.info("일정 캐시 저장(L1+L2): %s (%d항목, lang=%s)", sched_key, len(schedule), lang_code)

    return {
        "location": location,
        "location_name": location_name,
        "route_name": req.route_name,
        "schedule": schedule,
        "cost_summary": result.get("cost_summary"),
        "error": result.get("error"),
        "thread_id": run_thread_id,
    }


async def _run_async_schedule_job(job_id: str, location: str, req: ScheduleRequest) -> None:
    """백그라운드: 동기 ``get_schedule`` 와 동일한 캐시·락·생성 순서."""
    location_name = SLUG_TO_NAME.get(location, location)
    try:
        user_profile = await fetch_user_profile(req.user_id)
        nationality = (user_profile or {}).get("nationality", "")
        lang_code = nationality[:3].lower() if nationality else "ko"
        sched_transport_tag = req.transport_mode or "any"
        search_tag = "s1" if req.use_search else "s0"
        sched_key = (
            f"{location}:{req.route_name}:{req.start_date}:{req.end_date}"
            f":{lang_code}:{sched_transport_tag}:{search_tag}"
        )

        await _async_job_put(
            job_id,
            {
                "status": "running",
                "job_id": job_id,
                "location": location,
                "location_name": location_name,
                "route_name": req.route_name,
                "sched_key": sched_key,
            },
        )

        cached_sched = _schedule_cache.get(sched_key)
        if cached_sched and time.time() - cached_sched[1] < _SCHEDULE_TTL:
            await _async_job_put(
                job_id,
                {
                    "status": "completed",
                    "job_id": job_id,
                    "location": location,
                    "location_name": location_name,
                    "route_name": req.route_name,
                    "schedule": cached_sched[0],
                    "error": None,
                    "source": "L1_cache",
                },
            )
            return

        factory = _get_async_session_factory()
        async with factory() as db:
            try:
                async with _schedule_lock:
                    cached_sched = _schedule_cache.get(sched_key)
                    if cached_sched and time.time() - cached_sched[1] < _SCHEDULE_TTL:
                        await _async_job_put(
                            job_id,
                            {
                                "status": "completed",
                                "job_id": job_id,
                                "location": location,
                                "location_name": location_name,
                                "route_name": req.route_name,
                                "schedule": cached_sched[0],
                                "error": None,
                                "source": "L1_cache_lock",
                            },
                        )
                        return

                    try:
                        db_schedule = await _get_schedule_from_db(sched_key, db)
                    except Exception as db_ex:
                        logger.warning("일정 L2(DB) 캐시 조회 실패(생성으로 진행): %s", db_ex)
                        await db.rollback()
                        db_schedule = None
                    if db_schedule:
                        _schedule_cache[sched_key] = (db_schedule, time.time())
                        logger.info("일정 L2(DB)캐시 히트: %s (%d항목)", sched_key, len(db_schedule))
                        await _async_job_put(
                            job_id,
                            {
                                "status": "completed",
                                "job_id": job_id,
                                "location": location,
                                "location_name": location_name,
                                "route_name": req.route_name,
                                "schedule": db_schedule,
                                "error": None,
                                "source": "L2_db",
                            },
                        )
                        return

                    result_body = await _generate_schedule_after_cache_miss(
                        location,
                        location_name,
                        req,
                        user_profile,
                        lang_code,
                        nationality,
                        sched_key,
                        search_tag,
                        db,
                    )
                await db.commit()
            except Exception:
                await db.rollback()
                raise

        await _async_job_put(
            job_id,
            {
                "status": "completed",
                "job_id": job_id,
                "source": "generated",
                **result_body,
            },
        )
    except HTTPException as he:
        await _async_job_put(
            job_id,
            {"status": "failed", "job_id": job_id, "error": str(he.detail), "http_status": he.status_code},
        )
    except Exception as e:
        logger.exception("비동기 일정 job 실패 job_id=%s", job_id)
        await _async_job_put(
            job_id,
            {"status": "failed", "job_id": job_id, "error": _stream_schedule_error_message(e)},
        )

# ─── L2 DB 캐시 TTL ─────────────────────────────────────────────
_ROUTES_DB_TTL_DAYS = 5    # 루트: 5일 (장소/행사 변동 반영)
_SCHEDULE_DB_TTL_DAYS = 5  # 일정: 5일 (루트와 동일 주기)

# ScheduleCache / RouteCache 컬럼 길이(모델과 일치) — 초과 시 DB 오류·세션 깨짐 방지
_DB_SCHEDULE_LOC_MAX = 100
_DB_SCHEDULE_ROUTE_MAX = 200
_DB_SCHEDULE_CACHE_KEY_MAX = 512
_DB_ROUTE_LOC_MAX = 100
_DB_ROUTE_CACHE_KEY_MAX = 255


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
    ck = (cache_key or "")[:_DB_ROUTE_CACHE_KEY_MAX]
    loc = (location or "")[:_DB_ROUTE_LOC_MAX]
    expires_at = _now_utc() + timedelta(days=_ROUTES_DB_TTL_DAYS)
    stmt = (
        pg_insert(RouteCache)
        .values(
            cache_key=ck,
            location=loc,
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
    ck = (cache_key or "")[:_DB_SCHEDULE_CACHE_KEY_MAX]
    loc = (location or "")[:_DB_SCHEDULE_LOC_MAX]
    rn = (route_name or "")[:_DB_SCHEDULE_ROUTE_MAX]
    expires_at = _now_utc() + timedelta(days=_SCHEDULE_DB_TTL_DAYS)
    stmt = (
        pg_insert(ScheduleCache)
        .values(
            cache_key=ck,
            location=loc,
            route_name=rn,
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
    # 대구권 랜드마크 (슬러그만 넘어오면 OWM 지오코딩이 실패하므로 한글 고정)
    "suseongmot":    "수성못",
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
        "user_id": None,
        "route_name": None,
        "start_date": start_date,
        "end_date": end_date,
        "transport_mode": None,
        "use_search": False,
        "user_profile": None,
        "festivals": [],
        "news_top10": [],
        "weather_forecast": None,
        "web_search_context": None,
        "web_search_gather_attempted": False,
        "naver_tips_context": None,
        "naver_tips_gather_attempted": False,
        "routes": [],
        "schedule": [],
        "cost_summary": None,
        "error": None,
        "existing_routes": [],
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

    # 루트 생성은 프로필 개인화를 사용하지 않으므로 user_profile 조회를 생략한다.
    # lang_code는 루트 캐시 키/메타 호환을 위해 고정값을 사용한다.
    user_profile = None
    nationality = None
    lang_code = "ko"
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
        try:
            db_routes = await _get_routes_from_db(cache_key, db)
        except Exception as db_ex:
            logger.warning("루트 L2(DB) 캐시 조회 실패(생성으로 진행): %s", db_ex)
            await db.rollback()
            db_routes = None
        if db_routes:
            _routes_cache[cache_key] = (db_routes, time.time())
            logger.info("루트 L2(DB)캐시 히트: %s (%d건)", cache_key, len(db_routes))
            return {"location": location, "location_name": location_name, "routes": db_routes}

        # 루트 생성은 순수 LLM만 사용 (행사·뉴스는 generate_routes 노드에서 불필요)
        # → 외부 API 호출 없이 즉시 그래프 실행
        logger.info(
            "루트 생성 시작: location=%s | lang=%s | 기존 제외=%d건 | 이동수단=%s",
            location, lang_code, len(existing_routes), transport_tag,
        )
        state = {
            **_base_state(location, req.start_date, req.end_date),
            "existing_routes": existing_routes,
            "transport_mode": req.transport_mode,
        }
        try:
            result = await std_graph.routes_graph.ainvoke(state)
        except Exception as e:
            await db.rollback()
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
            await db.rollback()
        logger.info("루트 캐시 저장(L1+L2): %s (%d건, lang=%s)", cache_key, len(routes), lang_code)
        return {"location": location, "location_name": location_name, "routes": routes}


@router.post("/{location}/schedule", summary="선택 루트 AI 일정 생성 (저장 없음)")
async def get_schedule(location: str, req: ScheduleRequest, db: AsyncSession = Depends(get_db)):
    """일정 생성 엔드포인트.

    캐시 키 확정을 위해 user_profile을 먼저 조회한 뒤,
    행사·뉴스·날씨·웹검색 수집은 LangGraph gather_context_node에서 병렬로 처리한다.
    """
    location_name = SLUG_TO_NAME.get(location, location)

    # 캐시 키 확정을 위해 프로필만 먼저 조회
    user_profile = await fetch_user_profile(req.user_id)
    nationality = (user_profile or {}).get("nationality", "")
    lang_code = nationality[:3].lower() if nationality else "ko"
    sched_transport_tag = req.transport_mode or "any"
    search_tag = "s1" if req.use_search else "s0"
    sched_key = (
        f"{location}:{req.route_name}:{req.start_date}:{req.end_date}"
        f":{lang_code}:{sched_transport_tag}:{search_tag}"
    )

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

        try:
            db_schedule = await _get_schedule_from_db(sched_key, db)
        except Exception as db_ex:
            logger.warning("일정 L2(DB) 캐시 조회 실패(생성으로 진행): %s", db_ex)
            await db.rollback()
            db_schedule = None
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

        # 행사·뉴스·날씨·웹검색은 gather_context_node에서 병렬 수집
        # 프론트에서 넘어온 뉴스가 있으면 state에 담아 gather_context_node가 재사용
        return await _generate_schedule_after_cache_miss(
            location,
            location_name,
            req,
            user_profile,
            lang_code,
            nationality,
            sched_key,
            search_tag,
            db,
        )


@router.get(
    "/schedule/jobs/{job_id}",
    summary="비동기 일정 job 상태 조회",
)
async def get_schedule_job_status(job_id: str):
    """``POST .../schedule/async`` 로 받은 ``job_id`` 로 폴링한다.

    - ``status``: ``pending`` | ``running`` | ``completed`` | ``failed``
    - ``completed`` 이면 ``schedule``, ``cost_summary``, ``error`` 등 동기 응답과 동일 필드 확인.
    """
    data = await _async_job_get(job_id.strip())
    if not data:
        raise HTTPException(status_code=404, detail="job_id가 없거나 만료되었습니다.")
    return data


@router.post(
    "/{location}/schedule/async",
    summary="일정 생성 비동기 — 즉시 job_id 반환 후 백그라운드 실행",
)
async def start_schedule_async(
    location: str,
    req: ScheduleRequest,
    background_tasks: BackgroundTasks,
):
    """HTTP는 즉시 반환하고, 일정은 백그라운드에서 생성한다.

    완료 알림은 서버 푸시가 아니라 **폴링**(
    ``GET /api/v1/planner/schedule/jobs/{job_id}``)으로 ``status == completed`` 를 확인하면 된다.
    Upstash Redis가 설정된 경우 job 상태가 워커 간 공유된다.
    """
    job_id = secrets.token_urlsafe(18)
    await _async_job_put(
        job_id,
        {
            "status": "pending",
            "job_id": job_id,
            "location": location,
        },
    )
    background_tasks.add_task(_run_async_schedule_job, job_id, location, req)
    return {
        "job_id": job_id,
        "status": "pending",
        "poll_url": f"/api/v1/planner/schedule/jobs/{job_id}",
        "message": "GET poll_url로 status가 completed일 때 schedule 등을 확인하세요.",
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
    - run      : {"type":"run","thread_id":"…","langgraph_checkpoint":bool} — 재개용 ID(다음 요청 ``thread_id``)
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
    search_tag = "s1" if req.use_search else "s0"
    sched_key = (
        f"{location}:{req.route_name}:{req.start_date}:{req.end_date}"
        f":{lang_code}:{transport_tag}:{search_tag}"
    )
    run_tid = _schedule_thread_id(req)

    def _sse(obj: dict) -> str:
        try:
            return f"data: {json.dumps(obj, ensure_ascii=False, default=str)}\n\n"
        except Exception as ex:
            logger.warning("SSE JSON 직렬화 실패: %s", ex)
            return (
                "data: "
                + json.dumps(
                    {"type": "error", "message": "일정 응답을 만드는 중 직렬화 오류가 났습니다."},
                    ensure_ascii=False,
                )
                + "\n\n"
            )

    async def generate():
        # ── L1 캐시 히트 ────────────────────────────────────────────
        cached_sched = _schedule_cache.get(sched_key)
        if cached_sched and time.time() - cached_sched[1] < _SCHEDULE_TTL:
            items, cost = cached_sched
            yield _sse({"type": "cached", "schedule": items, "cost_summary": cost})
            yield _sse({"type": "done"})
            return

        try:
            # ── L2 DB 캐시 히트 ─────────────────────────────────────────
            db_schedule = None
            try:
                db_schedule = await _get_schedule_from_db(sched_key, db)
            except Exception as db_ex:
                logger.warning("일정 L2(DB) 캐시 조회 실패(생성으로 진행): %s", db_ex)
                await db.rollback()
            if db_schedule:
                _schedule_cache[sched_key] = (db_schedule, time.time())
                yield _sse({"type": "cached", "schedule": db_schedule, "cost_summary": None})
                yield _sse({"type": "done"})
                return

            # ── gather: Upstash에 스냅샷이 있으면 재사용(연결 끊김 후 재개) ─────────
            yield _sse(
                {
                    "type": "run",
                    "thread_id": run_tid,
                    "langgraph_checkpoint": schedule_checkpoint_active(),
                    "message": "이후 요청 본문에 동일 thread_id를 넣으면 수집 맥락·LangGraph 체크포인트를 이어갑니다.",
                }
            )
            ctx_state: dict = {
                **_base_state(location, req.start_date, req.end_date),
                "user_id": req.user_id,
                "user_profile": user_profile,
                "news_top10": req.news_top10 or [],
                "route_name": req.route_name,
                "transport_mode": req.transport_mode,
                "use_search": req.use_search,
            }
            saved_gather = await _try_load_stream_gather_snapshot(run_tid, sched_key)
            if saved_gather:
                _apply_stream_gather_fields(ctx_state, saved_gather)
                yield _sse({"type": "status", "message": "저장된 수집 맥락으로 재개합니다…"})
            else:
                yield _sse({"type": "status", "message": "행사·날씨·최신 정보 수집 중…"})
                ctx_task = asyncio.create_task(gather_context_node(ctx_state))  # type: ignore[arg-type]
                try:
                    async for _ka in _sse_keepalive_while(ctx_task):
                        yield _ka
                    ctx_state = ctx_task.result()
                except asyncio.CancelledError:
                    if not ctx_task.done():
                        ctx_task.cancel()
                    raise
                except Exception as e:
                    if not ctx_task.done():
                        ctx_task.cancel()
                        try:
                            await ctx_task
                        except asyncio.CancelledError:
                            pass
                    yield _sse({"type": "error", "message": f"컨텍스트 수집 실패: {e}"})
                    yield _sse({"type": "done"})
                    return
                await _save_stream_gather_snapshot(run_tid, sched_key, ctx_state)

            festivals = ctx_state.get("festivals") or []
            news_top10 = ctx_state.get("news_top10") or []
            weather_forecast = ctx_state.get("weather_forecast")
            raw_web_ctx = ctx_state.get("web_search_context") or ""
            poi_context_block = ctx_state.get("kakao_poi_context_block") or ""
            raw_naver_ctx = ctx_state.get("naver_tips_context") or ""

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
            news_block = build_news_block_for_prompt(news_top10, location_name, for_k_content=False, lang=lang)
            weather_block = build_weather_block_for_prompt(weather_forecast or {}, req.start_date, req.end_date)
            transport_block = _build_transport_block(req.transport_mode or "")
            festival_block = _build_festival_block(festivals, lang=lang)
            web_search_block = _format_web_search_block(raw_web_ctx, lang)
            naver_tips_block = _format_naver_tips_block(raw_naver_ctx, lang)

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
                web_search_block=web_search_block,
                poi_context_block=poi_context_block,
                naver_tips_block=naver_tips_block,
            )

            # ── Day별 순차 생성 (비스트리밍 일정과 동일: 이전 일차 장소·키 exclude) ──
            # 병렬 생성 시 Gemini 동시 호출로 타임아웃·부하가 겹치고 교차 일차 중복이 늘었음.
            yield _sse({"type": "status", "message": f"AI가 {num_days}일 일정 생성 중…"})

            all_items: list[dict] = []
            per_day_costs: list[dict] = []
            geocode_futures: list[tuple[int, "asyncio.Future[list[dict]]"]] = []
            item_offset = 0
            cumulative_exclude: list[str] = []
            seen_raw_place: set[str] = set()
            seen_venue_keys: set[str] = set()

            def _append_exclude_from_day(items: list[dict]) -> None:
                for it in items:
                    dk = _venue_dedupe_key(it, region=location_name, lang=lang)
                    if dk and dk not in seen_venue_keys:
                        seen_venue_keys.add(dk)
                        cumulative_exclude.append(dk)
                    for fld in ("place", "place_ko"):
                        s = (it.get(fld) or "").strip()
                        if s and s not in seen_raw_place:
                            seen_raw_place.add(s)
                            cumulative_exclude.append(s)

            for i, date_str in enumerate(date_list):
                day_task = asyncio.create_task(
                    _generate_single_day(
                        day_num=i + 1,
                        date_str=date_str,
                        exclude_places=list(cumulative_exclude) if cumulative_exclude else None,
                        **common_kwargs,
                    )
                )
                try:
                    async for _ka in _sse_keepalive_while(day_task):
                        yield _ka
                    items, per_day_cost = day_task.result()
                except asyncio.CancelledError:
                    if not day_task.done():
                        day_task.cancel()
                    raise
                except Exception as e:
                    logger.error("스트리밍 Day %d 생성 실패: %s", i + 1, e)
                    yield _sse({"type": "error", "message": str(e)})
                    continue
                all_items.extend(items)
                per_day_costs.append(per_day_cost)
                yield _sse({
                    "type": "day",
                    "items": items,
                    "cost": per_day_cost,
                })
                geo_fut = asyncio.ensure_future(
                    asyncio.gather(
                        *[_geocode_item(it, location_name) for it in items],
                        return_exceptions=True,
                    )
                )
                geocode_futures.append((item_offset, geo_fut))
                item_offset += len(items)
                _append_exclude_from_day(items)

            if not all_items:
                yield _sse({"type": "done"})
                return

            # ── 좌표 검증 결과 수집 + 경로 최적화 ───────────────────────
            yield _sse({"type": "status", "message": "좌표 검증 중…"})
            geocoded = list(all_items)
            try:
                for offset, geo_fut in geocode_futures:
                    results = await geo_fut
                    for j, res in enumerate(results):
                        if isinstance(res, dict):
                            geocoded[offset + j] = res
            except Exception as e:
                logger.warning("지오코딩 결과 수집 실패(스트리밍), 원본 유지: %s", e)

            days_map: dict[int, list] = {}
            for item in geocoded:
                days_map.setdefault(item.get("day", 1), []).append(item)
            optimized: list[dict] = []
            for day_num in sorted(days_map.keys()):
                optimized.extend(_optimize_day_order(days_map[day_num]))

            yield _sse({"type": "geocoded", "items": optimized})

            per_day_costs.sort(key=lambda x: x.get("day", 0))
            total_krw = sum(int(c.get("total_krw") or 0) for c in per_day_costs)
            cost_summary = {
                "per_day": [
                    {"day": c.get("day", 0), "total": c.get("total", "N/A")}
                    for c in per_day_costs
                ],
                "trip_total": f"₩{total_krw:,}" if total_krw else "N/A",
            }
            yield _sse({"type": "cost_summary", "data": cost_summary})

            _schedule_cache[sched_key] = (optimized, time.time())
            try:
                await _save_schedule_to_db(
                    sched_key, location_name, req.route_name, optimized, db,
                    lang_code=lang_code, nationality=nationality,
                )
            except Exception as e:
                logger.warning("스트리밍 일정 DB캐시 저장 실패(무시): %s", e)
                await db.rollback()

            await _clear_stream_gather_snapshot(run_tid)
            yield _sse({"type": "done"})
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.exception("스트리밍 일정 처리 중 예외")
            try:
                await db.rollback()
            except Exception:
                pass
            yield _sse({"type": "error", "message": _stream_schedule_error_message(e)})
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
            # 저장 시 전체 재크롤링은 지연이 크다.
            # 생성 단계에서 이미 business_hours가 붙은 항목은 유지하고,
            # 비어있는 항목만 최소 보강한다.
            need_enrich_idx = [
                i for i, item in enumerate(schedule)
                if not str(item.get("business_hours") or "").strip()
            ]
            if need_enrich_idx:
                subset = [schedule[i] for i in need_enrich_idx]
                enriched_subset = await enrich_schedule_items_with_hours(subset)
                for idx, enriched in zip(need_enrich_idx, enriched_subset):
                    schedule[idx] = enriched
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
            if item.get("title") not in modified_titles:
                return item
            return await _geocode_item(item, plan.location or "")

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
    new_item = await _geocode_item(new_item, location_name)
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
