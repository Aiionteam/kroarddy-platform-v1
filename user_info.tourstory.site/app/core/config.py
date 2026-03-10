"""설정 – DATABASE_URL 환경변수."""
import re
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

_DIR = Path(__file__).resolve().parents[3]          # user_info/
_PARENT = _DIR.parent                               # sevices.tourstory.site/

_local_env = _DIR / ".env"
_parent_env = _PARENT / ".env"

if _local_env.exists():
    load_dotenv(_local_env, override=True)
elif _parent_env.exists():
    load_dotenv(_parent_env, override=True)

_env_file = str(_local_env) if _local_env.exists() else str(_parent_env)


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

    model_config = {"env_file": _env_file, "extra": "ignore"}

    def get_async_url(self) -> str:
        return _adapt_asyncpg(self.database_url)

    def get_sync_url(self) -> str:
        return _adapt_psycopg2(self.database_url)


settings = Settings()
