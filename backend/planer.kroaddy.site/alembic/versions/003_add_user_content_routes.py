"""add user_content_routes table

Revision ID: 003
Revises: 002
Create Date: 2026-03-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_content_routes",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("location", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("route_items", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("image_data", sa.Text(), nullable=True),
        sa.Column("image_mime", sa.String(length=50), nullable=True),
        sa.Column("likes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_content_routes_user_id", "user_content_routes", ["user_id"])
    op.create_index("ix_user_content_routes_created_at", "user_content_routes", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_user_content_routes_created_at", table_name="user_content_routes")
    op.drop_index("ix_user_content_routes_user_id", table_name="user_content_routes")
    op.drop_table("user_content_routes")
