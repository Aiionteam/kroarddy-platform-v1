"""설정 – DATABASE_URL 환경변수."""
import re
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# MSA 구조: user_info.tourstory.site/app/core/config.py
#   parents[0] = app/core/
#   parents[1] = app/
#   parents[2] = user_info.tourstory.site/  ← 서비스 루트
_SERVICE_DIR = Path(__file__).resolve().parents[2]

_env_path = _SERVICE_DIR / ".env"
if _env_path.exists():
    load_dotenv(_env_path, override=True)


def _adapt_asyncpg(url: str) -> str:
    url = re.sub(r"[&?]?channel_binding=[^&]*", "", url)
    url = re.sub(r"[&?]?sslmode=[^&]*", "", url)
    url = re.sub(r"\?&+", "?", url)
    url = re.sub(r"&{2,}", "&", url)
    url = url.rstrip("?&")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def _adapt_psycopg2(url: str) -> str:
    url = re.sub(r"[&?]?channel_binding=[^&]*", "", url)
    url = re.sub(r"\?&+", "?", url)
    url = url.rstrip("?&")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


class Settings(BaseSettings):
    database_url: str = ""

    model_config = {"env_file": str(_env_path), "extra": "ignore"}

    def get_async_url(self) -> str:
        return _adapt_asyncpg(self.database_url)

    def get_sync_url(self) -> str:
        return _adapt_psycopg2(self.database_url)


settings = Settings()
