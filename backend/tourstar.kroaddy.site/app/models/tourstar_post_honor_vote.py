"""투어스타 게시물 명예도(썸업/썸다운) — 사용자당 1표."""

from typing import ClassVar

from sqlalchemy import BigInteger, ForeignKey, SmallInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database.base import Base


class TourstarPostHonorVote(Base):
    __tablename__: ClassVar[str] = "tourstar_post_honor_votes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("tourstar_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    # +1 = up, -1 = down
    vote: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_tourstar_post_honor_votes_post_user"),)
