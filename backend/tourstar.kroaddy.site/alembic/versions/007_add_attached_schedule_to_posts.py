"""add attached_schedule JSON to tourstar_posts (planner snapshot)

Revision ID: 007
Revises: 006
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tourstar_posts",
        sa.Column("attached_schedule", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tourstar_posts", "attached_schedule")
