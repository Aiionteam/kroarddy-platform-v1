import re
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

_env = Path(__file__).resolve().parents[2] / ".env"
if _env.exists():
    load_dotenv(_env, override=True)


def _adapt_pg_url(url: str) -> str:
    """postgresql:// → psycopg2 호환 (channel_binding 제거, sslmode 유지)."""
    url = re.sub(r"[&?]?channel_binding=[^&]*", "", url)
    url = re.sub(r"\?&+", "?", url)
    url = re.sub(r"&{2,}", "&", url)
    return url.rstrip("?&")


class Settings(BaseSettings):
    openai_api_key: str = ""
    database_url: str = ""

    model_config = {"env_file": str(_env), "extra": "ignore"}

    def get_db_url(self) -> str:
        return _adapt_pg_url(self.database_url)


settings = Settings()
