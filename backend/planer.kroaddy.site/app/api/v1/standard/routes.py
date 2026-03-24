"""Standard 플래너 API 라우터 – 루트 추천 / 일정 생성 / 플랜 관리."""
import asyncio
import hashlib
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.agent.standard.graph import routes_graph, schedule_graph
from app.agent.standard.nodes import _is_daily_quota, _geocode_item, modify_schedule, reroll_single_item
from app.core.database.session import get_db
from app.models.travel_plan import TravelPlan
from app.models.plan_cache import RouteCache, ScheduleCache
from app.services.festival_client import fetch_festivals_for_period
from app.services.news_client import fetch_news_top10
from app.services.user_info_client import fetch_user_profile
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
_ROUTES_DB_TTL_DAYS = 7
_SCHEDULE_DB_TTL_DAYS = 30


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


async def _save_routes_to_db(cache_key: str, location: str, routes: list, db: AsyncSession) -> None:
    expires_at = _now_utc() + timedelta(days=_ROUTES_DB_TTL_DAYS)
    stmt = (
        pg_insert(RouteCache)
        .values(cache_key=cache_key, location=location, routes=routes, expires_at=expires_at)
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
    cache_key: str, location: str, route_name: str, schedule: list, db: AsyncSession
) -> None:
    expires_at = _now_utc() + timedelta(days=_SCHEDULE_DB_TTL_DAYS)
    stmt = (
        pg_insert(ScheduleCache)
        .values(
            cache_key=cache_key,
            location=location,
            route_name=route_name,
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
    "mokpo":         "목포",
    "yeosu":         "여수",
    "suncheon":      "순천",
    "naju":          "나주",
    "gwangyang":     "광양",
    "damyang":       "담양",
    "boseong":       "보성",
    "wando":         "완도",
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


@router.post("/{location}/routes", summary="여행 루트 7개 AI 추천 (행사/먹거리/명소/럭셔리/가성비/가족/커플)")
async def get_routes(location: str, req: RoutesRequest, db: AsyncSession = Depends(get_db)):
    location_name = SLUG_TO_NAME.get(location, location)
    existing_routes: list[str] = req.existing_routes or []
    eh = _existing_hash(existing_routes)
    search_tag = "s1" if req.use_search else "s0"
    # 언어별 캐시 분리를 위해 user_profile 조회 후 cache_key 확정 (아래 lock 블록에서 재정의)
    _preliminary_key = f"{location}:{req.start_date}:{req.end_date}:{eh}:{search_tag}"

    cached = _routes_cache.get(_preliminary_key)
    if cached and time.time() - cached[1] < _ROUTES_TTL:
        logger.info("루트 L1캐시 히트: %s", _preliminary_key)
        return {"location": location, "location_name": location_name, "routes": cached[0]}

    async with _routes_lock:
        cached = _routes_cache.get(_preliminary_key)
        if cached and time.time() - cached[1] < _ROUTES_TTL:
            logger.info("루트 L1캐시 히트(lock 내부): %s", _preliminary_key)
            return {"location": location, "location_name": location_name, "routes": cached[0]}

        # 뉴스 Top10: 프론트에서 이미 가져온 데이터가 있으면 재사용 (API 호출 절약)
        _has_client_news = bool(req.news_top10)
        festivals, user_profile, news_top10 = await asyncio.gather(
            fetch_festivals_for_period(location, location_name, req.start_date, req.end_date),
            fetch_user_profile(req.user_id),
            asyncio.sleep(0) if _has_client_news else fetch_news_top10(req.start_date, req.end_date),
        )
        if _has_client_news:
            news_top10 = req.news_top10  # type: ignore[assignment]

        nationality = (user_profile or {}).get("nationality", "")
        lang_code = nationality[:3].lower() if nationality else "ko"  # 캐시 키용 짧은 식별자
        cache_key = f"{location}:{req.start_date}:{req.end_date}:{eh}:{lang_code}:{search_tag}"

        logger.info(
            "행사 연동: location=%s, 건수=%d | 뉴스 Top10: %d건(%s) | 유저 프로필: %s (국적=%s) | 기존 제외=%d건",
            location, len(festivals), len(news_top10 or []),
            "client" if _has_client_news else "fetched",
            bool(user_profile), nationality, len(existing_routes),
        )

        state = {
            **_base_state(location, req.start_date, req.end_date),
            "festivals": festivals,
            "user_profile": user_profile,
            "existing_routes": existing_routes,
            "use_search": req.use_search,
            "news_top10": news_top10,
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
            await _save_routes_to_db(cache_key, location_name, routes, db)
        except Exception as e:
            logger.warning("루트 DB캐시 저장 실패 (무시): %s", e)
        logger.info("루트 캐시 저장(L1+L2): %s (%d건)", cache_key, len(routes))
        return {"location": location, "location_name": location_name, "routes": routes}


@router.post("/{location}/schedule", summary="선택 루트 AI 일정 생성 (저장 없음)")
async def get_schedule(location: str, req: ScheduleRequest, db: AsyncSession = Depends(get_db)):
    location_name = SLUG_TO_NAME.get(location, location)

    # user_profile 조회 (언어 결정 및 개인화용)
    user_profile = await fetch_user_profile(req.user_id)
    nationality = (user_profile or {}).get("nationality", "")
    lang_code = nationality[:3].lower() if nationality else "ko"
    sched_search_tag = "s1" if req.use_search else "s0"
    sched_key = f"{location}:{req.route_name}:{req.start_date}:{req.end_date}:{lang_code}:{sched_search_tag}"

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

        # 일정 생성에도 행사·뉴스 정보 반영
        # 뉴스 Top10: 프론트에서 이미 가져온 데이터가 있으면 재사용
        _has_client_news_s = bool(req.news_top10)
        festivals, news_top10 = await asyncio.gather(
            fetch_festivals_for_period(location, location_name, req.start_date, req.end_date),
            asyncio.sleep(0) if _has_client_news_s else fetch_news_top10(req.start_date, req.end_date),
        )
        if _has_client_news_s:
            news_top10 = req.news_top10  # type: ignore[assignment]

        logger.info(
            "일정 생성 연동: location=%s, 행사=%d건, 뉴스Top10=%d건(%s)",
            location, len(festivals), len(news_top10 or []),
            "client" if _has_client_news_s else "fetched",
        )

        state = {
            **_base_state(location, req.start_date, req.end_date),
            "route_name": req.route_name,
            "user_profile": user_profile,
            "festivals": festivals,
            "use_search": req.use_search,
            "news_top10": news_top10,
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
                await _save_schedule_to_db(sched_key, location_name, req.route_name, schedule, db)
            except Exception as e:
                logger.warning("일정 DB캐시 저장 실패 (무시): %s", e)
            logger.info("일정 캐시 저장(L1+L2): %s (%d항목)", sched_key, len(schedule))

        return {
            "location": location,
            "location_name": location_name,
            "route_name": req.route_name,
            "schedule": schedule,
            "cost_summary": result.get("cost_summary"),
            "error": result.get("error"),
        }


@router.post("/plans", summary="여행 플랜 저장")
async def save_plan(req: SavePlanRequest, db: AsyncSession = Depends(get_db)):
    location_name = SLUG_TO_NAME.get(req.location, req.location)
    plan = TravelPlan(
        user_id=req.user_id,
        location=location_name,
        route_name=req.route_name,
        start_date=req.start_date,
        end_date=req.end_date,
        schedule=req.schedule,
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
