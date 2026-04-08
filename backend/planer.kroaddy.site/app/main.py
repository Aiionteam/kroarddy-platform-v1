"""Tour Planner – FastAPI 진입점."""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

# MSA 구조: planer.tourstory.site/app/main.py
#   parents[0] = planer.tourstory.site/app/
#   parents[1] = planer.tourstory.site/   ← 서비스 루트
_SERVICE_DIR = Path(__file__).resolve().parents[1]
_env = _SERVICE_DIR / ".env"
if _env.exists():
    from dotenv import load_dotenv
    load_dotenv(_env)

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import v1_router
from app.services.naver_map_client import close_naver_client
from app.services.news_client import close_news_client
from app.services.weather_client import close_weather_client
from app.services.user_info_client import close_user_info_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app_: FastAPI):
    logger.info("Tour Planner API starting (port %s)", os.getenv("PORT", "8003"))
    yield
    logger.info("Tour Planner API shutting down – closing shared HTTP clients")
    await close_naver_client()
    await close_news_client()
    await close_weather_client()
    await close_user_info_client()


app = FastAPI(
    title="Tour Planner API",
    version="2.0.0",
    description="LangGraph + OpenAI 기반 AI 여행 루트/일정 추천 서비스",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)


@app.get("/", tags=["meta"])
async def root():
    return {
        "service": "Tour Planner API",
        "version": "2.0.0",
        "endpoints": {
            "routes": "POST /api/v1/planner/{location}/routes",
            "schedule": "POST /api/v1/planner/{location}/schedule",
            "weather": "GET /api/v1/weather",
        },
    }


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8003"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
