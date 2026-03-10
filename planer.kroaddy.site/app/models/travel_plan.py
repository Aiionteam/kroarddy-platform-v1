"""SQLAlchemy 모델 – 여행 플랜."""
from sqlalchemy import BigInteger, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database.base import Base
from app.core.database.mixins import TimestampMixin


class TravelPlan(Base, TimestampMixin):
    __tablename__ = "travel_plans"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    location: Mapped[str] = mapped_column(String(100))
    route_name: Mapped[str] = mapped_column(String(200))
    start_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    end_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    schedule: Mapped[list | None] = mapped_column(JSON, nullable=True)
