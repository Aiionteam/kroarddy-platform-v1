"""migrate image_data/image_mime columns to image_url (S3)

Revision ID: 004
Revises: 003
Create Date: 2026-03-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_content_routes", sa.Column("image_url", sa.Text(), nullable=True))
    op.drop_column("user_content_routes", "image_mime")
    op.drop_column("user_content_routes", "image_data")


def downgrade() -> None:
    op.add_column("user_content_routes", sa.Column("image_data", sa.Text(), nullable=True))
    op.add_column("user_content_routes", sa.Column("image_mime", sa.String(length=50), nullable=True))
    op.drop_column("user_content_routes", "image_url")
