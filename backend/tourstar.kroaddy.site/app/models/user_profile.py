"""user_profiles 테이블 매핑 - profile.kroaddy.site 백엔드가 소유하는 테이블.
tourstar 백엔드는 profile_image_url 컬럼만 읽고 씁니다."""
from typing import Optional

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database.base import Base


class UserProfile(Base):
    """profile.kroaddy.site 가 소유하는 user_profiles 테이블.
    tourstar 에서는 user_id, profile_image_url 두 컬럼만 사용."""

    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True, index=True)
    profile_image_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
