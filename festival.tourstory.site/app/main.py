"""
Festival API - 전국문화축제표준데이터 기반 행사 목록.
공공데이터포털 인증키: DATA_GO_KR_SERVICE_KEY
"""
import asyncio
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

# 상위 디렉터리 .env 로드
_ROOT = Path(__file__).resolve().parents[2]
_env = _ROOT / ".env"
if _env.exists():
    from dotenv import load_dotenv
    load_dotenv(_env)

import uvicorn
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.services.festival_client import (
    FestivalUnavailableError,
    fetch_festivals,
    filter_by_year_month,
    normalize_item,
    parse_response_items,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# 공공 API 원본 목록 캐시
_CACHE_RAW_LIST: list[dict] | None = None
_CACHE_EXPIRES_AT: float = 0
_CACHE_TTL_SEC = 600        # 10분 신선 캐시
_CACHE_STALE_TTL_SEC = 3600 # 1시간 stale fallback (API 실패 시)
_CACHE_LOCK = asyncio.Lock() # Thundering Herd 방지


async def _warmup_cache() -> None:
    """서버 시작 시 백그라운드에서 공공 API 한 번 호출해 캐시 워밍."""
    global _CACHE_RAW_LIST, _CACHE_EXPIRES_AT
    try:
        logger.info("캐시 워밍 시작…")
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(
            None, lambda: fetch_festivals(page_no=1, num_of_rows=500)
        )
        resp = data.get("response") or {}
        header = resp.get("header") or {}
        result_code = str(header.get("resultCode", "")).strip()
        result_msg = (header.get("resultMsg") or "").upper()
        if result_code == "00" or (result_code not in ("03",) and "NODATA" not in result_msg):
            raw_list = parse_response_items(data)
            if raw_list:
                _CACHE_RAW_LIST = raw_list
                _CACHE_EXPIRES_AT = time.time() + _CACHE_TTL_SEC
                logger.info("캐시 워밍 완료 (raw=%d)", len(raw_list))
                return
        logger.warning("캐시 워밍: 공공 API 응답 없음 (code=%s, msg=%s)", result_code, result_msg)
    except Exception as e:
        logger.warning("캐시 워밍 실패 (첫 요청 시 자동 재시도): %s", e)


@asynccontextmanager
async def lifespan(app_: FastAPI):
    asyncio.create_task(_warmup_cache())
    yield


app = FastAPI(
    title="Festival API (전국문화축제표준데이터)",
    version="1.0.0",
    description="공공데이터포털 전국문화축제표준데이터 기반 행사 목록",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "Festival API",
        "version": "1.0.0",
        "endpoints": {
            "festivals": "GET /api/v1/festivals?year=&month=",
            "health": "GET /health",
        },
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/api/v1/festivals/debug")
async def get_festivals_debug():
    """디버깅: 공공API 원본 응답 최상위 키 구조 + 샘플 3건 그대로 반환."""
    try:
        data = fetch_festivals(page_no=1, num_of_rows=10)
    except Exception as e:
        return {"error": str(e)}
    raw_list = parse_response_items(data)
    resp = data.get("response") or {}
    header = resp.get("header") or {}
    return {
        "top_level_keys": list(data.keys()),
        "resultCode": header.get("resultCode"),
        "resultMsg": header.get("resultMsg"),
        "raw_count": len(raw_list),
        "sample": raw_list[:3] if raw_list else [],
        "raw_response_preview": {
            k: v for k, v in data.items() if k != "body"
        },
    }


@app.get("/api/v1/festivals/raw")
async def get_festivals_raw():
    """디버깅: 공공API 원본 응답에서 받은 건수·샘플 키만 반환 (필터 없음)."""
    try:
        data = fetch_festivals(page_no=1, num_of_rows=100)
    except Exception as e:
        return {"error": str(e), "raw_count": 0, "sample_keys": None}
    raw_list = parse_response_items(data)
    sample = raw_list[0] if raw_list else None
    return {
        "raw_count": len(raw_list),
        "sample_keys": list(sample.keys()) if sample else None,
        "sample_item": sample,
        "resultCode": (data.get("response") or {}).get("header", {}).get("resultCode"),
    }


@app.get("/api/v1/festivals")
async def get_festivals(
    year: int | None = Query(None, description="연도"),
    month: int | None = Query(None, description="월 (1-12)"),
):
    """전국문화축제표준데이터 기반 행사 목록 (연·월 필터). 캐시 10분."""
    from datetime import datetime
    global _CACHE_RAW_LIST, _CACHE_EXPIRES_AT
    now = datetime.now()
    y = year if year is not None else now.year
    m = month if month is not None else now.month

    raw_list: list[dict] | None = None
    now_ts = time.time()

    # ① 신선 캐시 사용
    if _CACHE_RAW_LIST is not None and now_ts < _CACHE_EXPIRES_AT:
        raw_list = _CACHE_RAW_LIST
        logger.debug("Festival 캐시 사용 (raw=%d)", len(raw_list))

    else:
        # ② Lock 으로 동시 갱신 방지 (Thundering Herd)
        if _CACHE_LOCK.locked() and _CACHE_RAW_LIST is not None:
            # 다른 요청이 이미 갱신 중 → stale 캐시 즉시 반환
            logger.debug("캐시 갱신 중 – stale 캐시 사용 (raw=%d)", len(_CACHE_RAW_LIST))
            raw_list = _CACHE_RAW_LIST
        else:
            async with _CACHE_LOCK:
                # Lock 획득 후 다시 확인 (이미 갱신됐을 수 있음)
                if _CACHE_RAW_LIST is not None and time.time() < _CACHE_EXPIRES_AT:
                    raw_list = _CACHE_RAW_LIST
                else:
                    try:
                        loop = asyncio.get_event_loop()
                        data = await loop.run_in_executor(
                            None, lambda: fetch_festivals(page_no=1, num_of_rows=500)
                        )
                        resp = data.get("response") or {}
                        header = resp.get("header") or {}
                        result_code = str(header.get("resultCode", "")).strip()
                        result_msg = (header.get("resultMsg") or "").upper()
                        if result_code == "03" or "NODATA" in result_msg:
                            return {"year": y, "month": m, "items": [], "noData": True}
                        if result_code and result_code != "00":
                            return {
                                "year": y, "month": m, "items": [],
                                "error": header.get("resultMsg", "API 오류"),
                                "resultCode": result_code,
                            }
                        raw_list = parse_response_items(data)
                        _CACHE_RAW_LIST = raw_list
                        _CACHE_EXPIRES_AT = time.time() + _CACHE_TTL_SEC
                        logger.info("Festival 캐시 갱신 (raw=%d)", len(raw_list))

                    except FestivalUnavailableError as e:
                        # 서비스 안내/JS 챌린지 실패 → stale 캐시 사용, 조용히 처리
                        if _CACHE_RAW_LIST is not None:
                            logger.warning("공공API 일시 불가 – stale 캐시 사용: %s", e)
                            raw_list = _CACHE_RAW_LIST
                            # stale TTL 연장 (1시간)
                            _CACHE_EXPIRES_AT = time.time() + _CACHE_STALE_TTL_SEC
                        else:
                            logger.warning("공공API 일시 불가 + 캐시 없음: %s", e)
                            return {"year": y, "month": m, "items": [], "error": str(e)}

                    except Exception as e:
                        if _CACHE_RAW_LIST is not None:
                            logger.warning("Festival API 오류 – stale 캐시 fallback: %s", e)
                            raw_list = _CACHE_RAW_LIST
                        else:
                            logger.exception("Festival API 호출 실패 (캐시 없음): %s", e)
                            return {"year": y, "month": m, "items": [], "error": str(e)}

    filtered = filter_by_year_month(raw_list, y, m)

    logger.info(
        "Festival API raw=%d filtered=%d (year=%d month=%d)",
        len(raw_list), len(filtered), y, m,
    )
    # 필터 후 0건일 때 샘플 날짜 로그로 원인 추적
    if raw_list and not filtered:
        for i, s in enumerate(raw_list[:5]):
            logger.info(
                "  sample[%d] start=%s end=%s",
                i,
                s.get("fstvlStartDate") or s.get("축제시작일자") or "없음",
                s.get("fstvlEndDate") or s.get("축제종료일자") or "없음",
            )

    items = [normalize_item(it) for it in filtered]

    # 디버그 정보: 0건일 때만 포함 (원인 파악용)
    debug_info = None
    if not items and raw_list:
        sample = raw_list[0]
        debug_info = {
            "raw_total": len(raw_list),
            "sample_start": sample.get("fstvlStartDate") or sample.get("축제시작일자"),
            "sample_end": sample.get("fstvlEndDate") or sample.get("축제종료일자"),
            "sample_keys": list(sample.keys())[:10],
        }

    result: dict = {"year": y, "month": m, "items": items}
    if debug_info:
        result["_debug"] = debug_info
    return result


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8002"))
    # 실행: sevices 루트 .env 사용. festival/ 디렉터리에서: uvicorn app.main:app --host 0.0.0.0 --port 8002
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
    )
