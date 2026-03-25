"""add nickname to user_content_routes

Revision ID: 011
Revises: 010
Create Date: 2026-03-24
"""

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_content_routes",
        sa.Column("nickname", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_content_routes", "nickname")
