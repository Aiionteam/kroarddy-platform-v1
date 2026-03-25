"""add profile_image_url to user_profiles

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-25
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column("profile_image_url", sa.String(length=1000), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_profiles", "profile_image_url")
