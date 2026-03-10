"""유저 컨텐츠 루트 DB 모델."""
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, JSON, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database.base import Base


class UserContentRoute(Base):
    __tablename__ = "user_content_routes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # AI가 다듬은 루트 항목: [{order, place, description, tip}]
    route_items: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # AI가 추출한 태그: ["#맛집", "#야경", ...]
    tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # 이미지 (base64 인코딩, nullable)
    image_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_mime: Mapped[str | None] = mapped_column(String(50), nullable=True)

    likes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
