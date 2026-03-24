"""tourstar_posts 테이블 모델 – 사진 선택 후 생성된 게시물."""
from typing import Optional

from sqlalchemy import BigInteger, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database.base import Base
from app.core.database.mixins import TimestampMixin


class TourstarPost(Base, TimestampMixin):
    """YOLO 사진 선택 후 생성된 여행 게시물.

    photo_urls: S3(kroaddy-tourstar-images) 에 저장된 선택 사진 URL 목록
    selected_scores: 각 사진의 품질 점수 정보 (YOLO/MUSIQ 결과)
    """

    __tablename__ = "tourstar_posts"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    author_nickname: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    title: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # S3에 저장된 선택된 사진 URL 목록
    photo_urls: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # YOLO 평가 결과 (점수, 순위 등 메타데이터)
    selected_scores: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # 게시물 공개 여부 ('public' / 'private')
    visibility: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="public"
    )
