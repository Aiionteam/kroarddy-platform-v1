"""비동기 DB 세션 – NeonDB (asyncpg)."""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

_engine = create_async_engine(
    settings.get_async_url(),
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={"ssl": "require"},
)

_SessionLocal = async_sessionmaker(_engine, expire_on_commit=False)


async def get_db():
    async with _SessionLocal() as session:
        async with session.begin():
            yield session
