"""add festival_cache table

Revision ID: 013
Revises: 012
Create Date: 2026-04-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "festival_cache",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("cache_key", sa.String(length=255), nullable=False),
        sa.Column("location", sa.String(length=100), nullable=False),
        sa.Column("start_date", sa.String(length=10), nullable=False),
        sa.Column("end_date", sa.String(length=10), nullable=False),
        sa.Column("festivals", sa.JSON(), nullable=False),
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
    op.create_index("ix_festival_cache_cache_key", "festival_cache", ["cache_key"], unique=False)
    op.create_index("ix_festival_cache_location", "festival_cache", ["location"], unique=False)
    op.create_index("ix_festival_cache_expires_at", "festival_cache", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_festival_cache_expires_at", table_name="festival_cache")
    op.drop_index("ix_festival_cache_location", table_name="festival_cache")
    op.drop_index("ix_festival_cache_cache_key", table_name="festival_cache")
    op.drop_table("festival_cache")
