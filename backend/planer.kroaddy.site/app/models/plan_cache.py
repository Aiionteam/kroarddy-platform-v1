"""SQLAlchemy 모델 – 루트/일정 DB 캐시."""
from datetime import datetime
from typing import ClassVar, Optional

from sqlalchemy import BigInteger, DateTime, JSON, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database.base import Base


class RouteCache(Base):
    """Gemini 루트 추천 결과 DB 캐시.

    cache_key = "{location}:{start}:{end}:{existing_hash}:{lang_code}:{search}:{transport}"
    lang_code / nationality 는 같은 지역이라도 국적별로 언어가 다른 캐시를
    분리 저장·조회하기 위한 메타 컬럼입니다.
    """
    __tablename__: ClassVar[str] = "route_cache"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    cache_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    lang_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    nationality: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    routes: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ScheduleCache(Base):
    """Gemini 일정 생성 결과 DB 캐시.

    cache_key = "{location}:{route_name}:{start}:{end}:{lang_code}:{search}:{transport}"
    """
    __tablename__: ClassVar[str] = "schedule_cache"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    cache_key: Mapped[str] = mapped_column(String(512), unique=True, nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    route_name: Mapped[str] = mapped_column(String(200), nullable=False)
    lang_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    nationality: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    schedule: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FestivalCache(Base):
    """행사 원천 데이터 DB 캐시.

    주기적으로 쌓이지 않도록 expires_at 지난 데이터는 조회 시 정리한다.
    cache_key = "{location}:{start}:{end}"
    """
    __tablename__: ClassVar[str] = "festival_cache"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    cache_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    start_date: Mapped[str] = mapped_column(String(10), nullable=False)
    end_date: Mapped[str] = mapped_column(String(10), nullable=False)
    festivals: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
