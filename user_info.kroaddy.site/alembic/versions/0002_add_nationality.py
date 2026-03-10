"""add nationality to user_profiles

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column("nationality", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_profiles", "nationality")
