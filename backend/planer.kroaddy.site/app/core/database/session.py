from typing import AsyncGenerator

from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# ── 지연 초기화 (DATABASE_URL이 비어있어도 import 시점에 터지지 않음) ──

_async_engine = None
_async_session_factory = None
_sync_engine = None


def _get_async_engine():
    global _async_engine
    if _async_engine is None:
        url = settings.get_async_url()
        if not url or url.endswith("://"):
            raise RuntimeError(
                "DATABASE_URL 환경변수가 설정되지 않았습니다. "
                "tourplaner/.env 또는 docker-compose env_file을 확인하세요."
            )
        _async_engine = create_async_engine(
            url,
            pool_size=5,
            max_overflow=10,
            echo=False,
            pool_pre_ping=True,    # 사용 전 연결 유효성 확인 (NeonDB 유휴 끊김 대응)
            pool_recycle=300,      # 5분마다 커넥션 갱신
            connect_args={"ssl": True},
        )
    return _async_engine


def _get_async_session_factory():
    global _async_session_factory
    if _async_session_factory is None:
        _async_session_factory = async_sessionmaker(
            _get_async_engine(), class_=AsyncSession, expire_on_commit=False
        )
    return _async_session_factory


def get_sync_engine():
    global _sync_engine
    if _sync_engine is None:
        url = settings.get_sync_url()
        if not url or url.endswith("://"):
            raise RuntimeError("DATABASE_URL 환경변수가 설정되지 않았습니다.")
        _sync_engine = create_engine(url, echo=False)
    return _sync_engine


# Alembic 호환용 속성 (기존 코드 호환)
@property
def engine():
    return _get_async_engine()


@property
def sync_engine():
    return get_sync_engine()


AsyncSessionLocal = _get_async_session_factory  # callable


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    factory = _get_async_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


SyncSessionLocal = sessionmaker  # 실제 사용 시 get_sync_engine() 으로 바인드
