"""tourstar_post_comments 테이블 모델."""
from typing import ClassVar

from sqlalchemy import BigInteger, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database.base import Base
from app.core.database.mixins import TimestampMixin


class TourstarPostComment(Base, TimestampMixin):
    __tablename__: ClassVar[str] = "tourstar_post_comments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("tourstar_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # 댓글 작성자 user_id (없을 수 있음: 레거시/익명/외부 입력)
    user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    author: Mapped[str] = mapped_column(String(100), nullable=False, server_default="me")
    content: Mapped[str] = mapped_column(Text, nullable=False)
