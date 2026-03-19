"""Settings – DATABASE_URL / AWS S3 환경변수 읽기."""
import re
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# MSA 구조: tourstar.kroaddy.site/app/core/config.py
#   parents[0] = app/core/
#   parents[1] = app/
#   parents[2] = tourstar.kroaddy.site/  ← 서비스 루트
_SERVICE_DIR = Path(__file__).resolve().parents[2]

_env_path = _SERVICE_DIR / ".env"
if _env_path.exists():
    load_dotenv(_env_path, override=True)


def _adapt_url(url: str, driver: str) -> str:
    """postgresql:// → postgresql+asyncpg:// or +psycopg2://.
    asyncpg는 sslmode/channel_binding을 URL 파라미터로 지원하지 않으므로 제거.
    psycopg2는 sslmode=require 유지.
    """
    url = re.sub(r"[&?]?channel_binding=[^&]*", "", url)

    if driver == "asyncpg":
        url = re.sub(r"[&?]?sslmode=[^&]*", "", url)

    url = re.sub(r"\?&+", "?", url)
    url = re.sub(r"&{2,}", "&", url)
    url = url.rstrip("?&")

    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", f"postgresql+{driver}://", 1)
    return url


class Settings(BaseSettings):
    openai_api_key: str = ""
    database_url: str = ""

    # AWS S3 - 게시물 이미지 저장소
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "ap-northeast-2"
    s3_bucket_name: str = "kroaddy-tourstar-images"
    # 공개 URL 베이스 (S3 direct)
    # 예: https://kroaddy-tourstar-images.s3.ap-northeast-2.amazonaws.com
    s3_public_base_url: str = ""

    model_config = {"env_file": str(_env_path), "extra": "ignore"}

    def get_async_url(self) -> str:
        return _adapt_url(self.database_url, "asyncpg")

    def get_sync_url(self) -> str:
        return _adapt_url(self.database_url, "psycopg2")


settings = Settings()
