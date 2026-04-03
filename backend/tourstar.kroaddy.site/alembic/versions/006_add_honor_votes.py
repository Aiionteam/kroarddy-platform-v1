"""add honor (thumbs up/down) votes for tourstar posts

Revision ID: 006
Revises: 005
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tourstar_posts",
        sa.Column("honor_up", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "tourstar_posts",
        sa.Column("honor_down", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "tourstar_post_honor_votes",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("post_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("vote", sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["tourstar_posts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("post_id", "user_id", name="uq_tourstar_post_honor_votes_post_user"),
        sa.CheckConstraint("vote IN (1, -1)", name="ck_tourstar_honor_vote_sign"),
    )
    op.create_index("ix_tourstar_post_honor_votes_post_id", "tourstar_post_honor_votes", ["post_id"])
    op.create_index("ix_tourstar_post_honor_votes_user_id", "tourstar_post_honor_votes", ["user_id"])

    # 기존 좋아요 → 명예 업표로 이관
    op.execute(
        """
        UPDATE tourstar_posts
        SET honor_up = COALESCE(likes, 0), honor_down = 0
        """
    )
    op.execute(
        """
        INSERT INTO tourstar_post_honor_votes (post_id, user_id, vote)
        SELECT post_id, user_id, 1
        FROM tourstar_post_likes
        """
    )
    op.execute(
        """
        UPDATE tourstar_posts
        SET likes = COALESCE(honor_up, 0) - COALESCE(honor_down, 0)
        """
    )


def downgrade() -> None:
    op.drop_index("ix_tourstar_post_honor_votes_user_id", table_name="tourstar_post_honor_votes")
    op.drop_index("ix_tourstar_post_honor_votes_post_id", table_name="tourstar_post_honor_votes")
    op.drop_table("tourstar_post_honor_votes")
    op.drop_column("tourstar_posts", "honor_down")
    op.drop_column("tourstar_posts", "honor_up")
