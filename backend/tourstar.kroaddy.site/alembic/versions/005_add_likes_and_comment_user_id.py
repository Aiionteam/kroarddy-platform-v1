"""add likes + comment user_id

Revision ID: 005
Revises: 004
Create Date: 2026-03-31
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # tourstar_posts.likes (집계)
    op.add_column(
        "tourstar_posts",
        sa.Column("likes", sa.Integer(), nullable=False, server_default="0"),
    )

    # tourstar_post_comments.user_id (댓글 작성자)
    op.add_column(
        "tourstar_post_comments",
        sa.Column("user_id", sa.BigInteger(), nullable=True),
    )
    op.create_index("ix_tourstar_post_comments_user_id", "tourstar_post_comments", ["user_id"])

    # likes table
    op.create_table(
        "tourstar_post_likes",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("post_id", sa.BigInteger(), sa.ForeignKey("tourstar_posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("post_id", "user_id", name="uq_tourstar_post_likes_post_user"),
    )
    op.create_index("ix_tourstar_post_likes_post_id", "tourstar_post_likes", ["post_id"])
    op.create_index("ix_tourstar_post_likes_user_id", "tourstar_post_likes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_tourstar_post_likes_user_id", table_name="tourstar_post_likes")
    op.drop_index("ix_tourstar_post_likes_post_id", table_name="tourstar_post_likes")
    op.drop_table("tourstar_post_likes")

    op.drop_index("ix_tourstar_post_comments_user_id", table_name="tourstar_post_comments")
    op.drop_column("tourstar_post_comments", "user_id")

    op.drop_column("tourstar_posts", "likes")

