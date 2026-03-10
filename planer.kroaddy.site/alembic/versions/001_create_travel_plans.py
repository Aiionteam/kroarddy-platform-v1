"""create travel_plans table

Revision ID: 001
Revises:
Create Date: 2026-02-09
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
        "travel_plans",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("location", sa.String(length=100), nullable=False),
        sa.Column("route_name", sa.String(length=200), nullable=False),
        sa.Column("start_date", sa.String(length=20), nullable=True),
        sa.Column("end_date", sa.String(length=20), nullable=True),
        sa.Column("schedule", sa.JSON(), nullable=True),
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
    op.create_index("ix_travel_plans_user_id", "travel_plans", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_travel_plans_user_id", table_name="travel_plans")
    op.drop_table("travel_plans")
