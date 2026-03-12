"""SQLAlchemy 모델 – 루트/일정 DB 캐시."""
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, JSON, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database.base import Base


class RouteCache(Base):
    """Gemini 루트 추천 결과 DB 캐시.

    cache_key = "{location}:{start_date}:{end_date}:{existing_hash}"
    """
    __tablename__ = "route_cache"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    cache_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(100), nullable=False)
    routes: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ScheduleCache(Base):
    """Gemini 일정 생성 결과 DB 캐시.

    cache_key = "{location}:{route_name}:{start_date}:{end_date}"
    """
    __tablename__ = "schedule_cache"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    cache_key: Mapped[str] = mapped_column(String(512), unique=True, nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(100), nullable=False)
    route_name: Mapped[str] = mapped_column(String(200), nullable=False)
    schedule: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
