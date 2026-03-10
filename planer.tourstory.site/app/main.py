"""Tour Planner – FastAPI 진입점."""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

# 상위 .env 로드 (Docker 볼륨 없이 로컬 실행 대비)
_ROOT = Path(__file__).resolve().parents[2]
_env = _ROOT / ".env"
if _env.exists():
    from dotenv import load_dotenv
    load_dotenv(_env)

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import v1_router

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
    logger.info("Tour Planner API shutting down")


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
