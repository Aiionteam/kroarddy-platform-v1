"""Settings – DATABASE_URL / GEMINI_API_KEY 환경변수 읽기."""
import re
from pathlib import Path

from pydantic_settings import BaseSettings

_TOURPLANER_DIR = Path(__file__).resolve().parents[3]  # tourplaner/
_SERVICES_DIR = _TOURPLANER_DIR.parent                 # sevices.tourstory.site/

# tourplaner/.env 우선, 없으면 상위 sevices.../.env 사용
_local_env = _TOURPLANER_DIR / ".env"
_parent_env = _SERVICES_DIR / ".env"

from dotenv import load_dotenv
if _local_env.exists():
    load_dotenv(_local_env, override=True)
elif _parent_env.exists():
    load_dotenv(_parent_env, override=True)

_env_file = str(_local_env) if _local_env.exists() else str(_parent_env)


def _adapt_url(url: str, driver: str) -> str:
    """postgresql:// → postgresql+asyncpg:// or +psycopg2://.
    asyncpg는 sslmode/channel_binding을 URL 파라미터로 지원하지 않으므로 제거.
    psycopg2는 sslmode=require 유지.
    """
    # channel_binding은 양쪽 모두 제거
    url = re.sub(r"[&?]?channel_binding=[^&]*", "", url)

    if driver == "asyncpg":
        # asyncpg: sslmode 제거 (ssl은 connect_args로 별도 전달)
        url = re.sub(r"[&?]?sslmode=[^&]*", "", url)

    # 파라미터 구분자 정리 (?& → ?, 끝의 ? & 제거)
    url = re.sub(r"\?&+", "?", url)
    url = re.sub(r"&{2,}", "&", url)
    url = url.rstrip("?&")

    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", f"postgresql+{driver}://", 1)
    return url


class Settings(BaseSettings):
    gemini_api_key: str = ""
    openai_api_key: str = ""        # Gemini 일일 쿼터 초과 시 gpt-4.1-mini 폴백용
    database_url: str = ""
    festival_service_url: str = "http://localhost:8002"
    user_info_service_url: str = "http://localhost:8004"

    model_config = {"env_file": _env_file, "extra": "ignore"}

    def get_async_url(self) -> str:
        return _adapt_url(self.database_url, "asyncpg")

    def get_sync_url(self) -> str:
        return _adapt_url(self.database_url, "psycopg2")


settings = Settings()
