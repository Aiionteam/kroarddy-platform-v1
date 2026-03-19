"""add user_content_likes table

Revision ID: 005
Revises: 004
Create Date: 2026-03-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_content_likes",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("route_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("route_id", "user_id", name="uq_user_content_like"),
    )
    op.create_index("ix_user_content_likes_route_id", "user_content_likes", ["route_id"])
    op.create_index("ix_user_content_likes_user_id", "user_content_likes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_content_likes_user_id", table_name="user_content_likes")
    op.drop_index("ix_user_content_likes_route_id", table_name="user_content_likes")
    op.drop_table("user_content_likes")
