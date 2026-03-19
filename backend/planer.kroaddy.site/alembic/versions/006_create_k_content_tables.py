"""create k_content_packages/k_content_places tables

Revision ID: 006
Revises: 005
Create Date: 2026-03-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "k_content_packages",
        sa.Column("package_id", sa.String(length=50), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("title_en", sa.String(length=255), nullable=False),
        sa.Column("description_en", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("tags", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("package_id"),
    )

    op.create_table(
        "k_content_places",
        sa.Column("place_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "package_id",
            sa.String(length=50),
            sa.ForeignKey("k_content_packages.package_id"),
            nullable=True,
        ),
        sa.Column("name_en", sa.String(length=255), nullable=False),
        sa.Column("lat", sa.Numeric(10, 8), nullable=False),
        sa.Column("lng", sa.Numeric(11, 8), nullable=False),
        sa.Column("description_en", sa.Text(), nullable=True),
        sa.Column("must_do_en", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("place_id"),
    )

    op.create_index("ix_k_content_places_package_id", "k_content_places", ["package_id"])


def downgrade() -> None:
    op.drop_index("ix_k_content_places_package_id", table_name="k_content_places")
    op.drop_table("k_content_places")
    op.drop_table("k_content_packages")

