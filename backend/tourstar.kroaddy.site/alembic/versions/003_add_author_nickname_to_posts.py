"""add author_nickname to tourstar_posts

Revision ID: 003
Revises: 002
Create Date: 2026-03-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tourstar_posts",
        sa.Column("author_nickname", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tourstar_posts", "author_nickname")
