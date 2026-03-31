"""tourstar_post_likes 테이블 모델.

- 게시물 좋아요를 사용자 단위로 저장한다.
- 집계(좋아요 수)는 tourstar_posts.likes 컬럼에 유지한다.
"""

from typing import ClassVar

from sqlalchemy import BigInteger, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database.base import Base
from app.core.database.mixins import TimestampMixin


class TourstarPostLike(Base, TimestampMixin):
    __tablename__: ClassVar[str] = "tourstar_post_likes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("tourstar_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)

    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_tourstar_post_likes_post_user"),)

