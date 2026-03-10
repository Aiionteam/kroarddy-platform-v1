"""사용자 여행 프로필 – NeonDB 테이블."""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, func
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class UserProfile(Base):
    """첫 로그인 시 수집하는 개인화 여행 프로필."""

    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, unique=True, nullable=False, index=True, comment="Java 게이트웨이 users.id")

    # 성별: 남성 / 여성 / 기타 / 무응답
    gender = Column(String(20), nullable=True)

    # 나이대: 10대 / 20대 / 30대 / 40대 / 50대 / 60대이상
    age_band = Column(String(20), nullable=True)

    # 식습관: 일반 / 채식 / 비건 / 할랄 / 알레르기있음
    dietary_pref = Column(String(50), nullable=True)

    # 종교: 없음 / 기독교 / 불교 / 천주교 / 이슬람 / 기타
    religion = Column(String(50), nullable=True)

    # 국적/거주 국가
    nationality = Column(String(50), nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=datetime.utcnow, nullable=False)
