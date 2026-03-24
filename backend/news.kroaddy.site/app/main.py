"""News API – 한국 뉴스 RSS 크롤링 + GPT 분류 서비스."""
import asyncio
import logging
import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routes import router
from app.services import database as db
from app.services.analyzer import run_pipeline
from app.services.crawler import warmup, enrich_og_images, _fetch_og_image_sync
from app.services.crawler import _fetch_category_sync  # 동기 fetch

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

REFRESH_INTERVAL = 6 * 60 * 60  # 6시간마다 크롤링 + GPT 분석


async def _collect_and_analyze() -> None:
    """모든 카테고리 RSS 수집 → DB 저장 → GPT 분석 파이프라인."""
    loop = asyncio.get_event_loop()
    total_new = 0
    try:
        items = await loop.run_in_executor(None, lambda: _fetch_category_sync("culture"))
        # 썸네일 없는 기사 og:image 보충 (최대 5개 동시)
        items = await enrich_og_images(items, max_concurrent=5)
        inserted = await loop.run_in_executor(
            None, lambda it=items: db.upsert_articles(it, "culture")
        )
        total_new += inserted
    except Exception as e:
        logger.warning("RSS 수집 실패: %s", e)

    logger.info("RSS 수집 완료: 신규 %d건", total_new)

    # 신규 기사가 있으면 GPT 분석 실행
    if total_new > 0:
        try:
            await run_pipeline()
        except Exception as e:
            logger.error("GPT 파이프라인 오류: %s", e)


async def _enrich_existing_thumbnails() -> None:
    """DB에 저장된 기사 중 썸네일 없는 것들의 og:image를 소급 보충."""
    loop = asyncio.get_event_loop()
    rows = await loop.run_in_executor(None, lambda: db.get_thumbnailless(limit=100))
    if not rows:
        return
    logger.info("썸네일 소급 보충 대상: %d건", len(rows))
    sem = asyncio.Semaphore(5)

    async def _one(row: dict) -> None:
        async with sem:
            img = await loop.run_in_executor(None, _fetch_og_image_sync, row["link"])
            if img:
                await loop.run_in_executor(None, lambda: db.update_thumbnail(row["id"], img))

    await asyncio.gather(*[_one(r) for r in rows])
    logger.info("썸네일 소급 보충 완료")


async def _scheduler() -> None:
    """백그라운드 주기 실행."""
    while True:
        try:
            await _collect_and_analyze()
        except Exception as e:
            logger.error("스케줄러 오류: %s", e)
        await asyncio.sleep(REFRESH_INTERVAL)


@asynccontextmanager
async def lifespan(app_: FastAPI):
    # DB 초기화
    db.init_db()
    logger.info("DB 초기화 완료")

    # 시작 시 즉시 1회 수집
    asyncio.create_task(_collect_and_analyze())
    # 기존 DB 기사 썸네일 소급 보충
    asyncio.create_task(_enrich_existing_thumbnails())
    # RSS 인메모리 캐시 워밍
    asyncio.create_task(warmup())  # culture 카테고리 워밍
    # 주기 스케줄러
    asyncio.create_task(_scheduler())

    yield


app = FastAPI(
    title="News API",
    version="2.0.0",
    description="한국 뉴스 RSS 크롤링 + GPT-5-mini 분류 서비스",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root():
    return {"service": "News API", "version": "2.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8005"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
