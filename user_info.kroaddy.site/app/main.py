"""User Info Service – 첫 로그인 시 수집하는 여행 개인화 프로필."""
import logging
import os
from pathlib import Path

# MSA 구조: user_info.tourstory.site/app/main.py
#   parents[0] = user_info.tourstory.site/app/
#   parents[1] = user_info.tourstory.site/   ← 서비스 루트
_env = Path(__file__).resolve().parents[1] / ".env"
if _env.exists():
    from dotenv import load_dotenv
    load_dotenv(_env)

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routes_profile import router as profile_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="User Info Service",
    version="1.0.0",
    description="첫 로그인 시 수집하는 여행 개인화 프로필 (성별·나이·식습관·종교)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile_router)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "user_info"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8004"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
