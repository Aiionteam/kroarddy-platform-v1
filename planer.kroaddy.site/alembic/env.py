"""Alembic 마이그레이션 환경 설정."""
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# tourplaner/ 를 Python 경로에 추가
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# .env 로드: tourplaner/.env 우선, 없으면 상위 sevices.../.env
from dotenv import load_dotenv
_tourplaner_dir = Path(__file__).resolve().parents[1]
_local_env = _tourplaner_dir / ".env"
_parent_env = _tourplaner_dir.parent / ".env"
if _local_env.exists():
    load_dotenv(_local_env, override=True)
elif _parent_env.exists():
    load_dotenv(_parent_env, override=True)

# 모델 import (Base.metadata 등록용)
from app.core.database.base import Base
from app.models.travel_plan import TravelPlan  # noqa: F401 – 모델 등록

from app.core.config import settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    return settings.get_sync_url()


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = get_url()
    connectable = engine_from_config(
        cfg,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
