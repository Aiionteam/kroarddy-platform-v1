"""add profile_image_url to existing user_profiles table

이 테이블은 profile.kroaddy.site 백엔드가 소유합니다.
tourstar 에서는 profile_image_url 컬럼만 추가합니다.

Revision ID: 004
Revises: 003
Create Date: 2026-03-25
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = [c["name"] for c in inspector.get_columns("user_profiles")]
    if "profile_image_url" not in existing_cols:
        op.add_column(
            "user_profiles",
            sa.Column("profile_image_url", sa.String(length=1000), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("user_profiles", "profile_image_url")
