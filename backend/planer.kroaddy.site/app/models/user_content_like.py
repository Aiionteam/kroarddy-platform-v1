"""유저 컨텐츠 좋아요 DB 모델 – 사용자당 루트 1회 제한."""
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database.base import Base


class UserContentLike(Base):
    __tablename__: str = "user_content_likes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    route_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("route_id", "user_id", name="uq_user_content_like"),
    )
