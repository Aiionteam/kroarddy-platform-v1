"""add route_cache and schedule_cache tables

Revision ID: 002
Revises: 001
Create Date: 2026-03-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "route_cache",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("cache_key", sa.String(length=255), nullable=False),
        sa.Column("location", sa.String(length=100), nullable=False),
        sa.Column("routes", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cache_key"),
    )
    op.create_index("ix_route_cache_cache_key", "route_cache", ["cache_key"])

    op.create_table(
        "schedule_cache",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("cache_key", sa.String(length=512), nullable=False),
        sa.Column("location", sa.String(length=100), nullable=False),
        sa.Column("route_name", sa.String(length=200), nullable=False),
        sa.Column("schedule", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cache_key"),
    )
    op.create_index("ix_schedule_cache_cache_key", "schedule_cache", ["cache_key"])


def downgrade() -> None:
    op.drop_index("ix_schedule_cache_cache_key", table_name="schedule_cache")
    op.drop_table("schedule_cache")
    op.drop_index("ix_route_cache_cache_key", table_name="route_cache")
    op.drop_table("route_cache")
