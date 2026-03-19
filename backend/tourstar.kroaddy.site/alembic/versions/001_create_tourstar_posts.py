"""create tourstar_posts table

Revision ID: 001
Revises:
Create Date: 2026-03-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tourstar_posts",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=300), nullable=True),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        # S3(kroaddy-tourstar-images) URL 목록
        sa.Column("photo_urls", sa.JSON(), nullable=True),
        # YOLO/MUSIQ 평가 점수 메타데이터
        sa.Column("selected_scores", sa.JSON(), nullable=True),
        sa.Column(
            "visibility",
            sa.String(length=20),
            nullable=False,
            server_default="public",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tourstar_posts_user_id", "tourstar_posts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_tourstar_posts_user_id", table_name="tourstar_posts")
    op.drop_table("tourstar_posts")
