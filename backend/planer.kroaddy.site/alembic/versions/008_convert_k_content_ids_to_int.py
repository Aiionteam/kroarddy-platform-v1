"""convert k_content package/place primary keys to int id

Revision ID: 008
Revises: 007
Create Date: 2026-03-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) packages: add integer id and backfill values
    op.add_column("k_content_packages", sa.Column("id", sa.Integer(), nullable=True))
    op.execute("CREATE SEQUENCE IF NOT EXISTS k_content_packages_id_seq")
    op.execute(
        "ALTER TABLE k_content_packages "
        "ALTER COLUMN id SET DEFAULT nextval('k_content_packages_id_seq')"
    )
    op.execute("UPDATE k_content_packages SET id = nextval('k_content_packages_id_seq') WHERE id IS NULL")
    op.execute(
        "SELECT setval('k_content_packages_id_seq', "
        "COALESCE((SELECT MAX(id) FROM k_content_packages), 1), true)"
    )
    op.alter_column("k_content_packages", "id", nullable=False)

    # 2) places: add int FK column and map old package_id(string) -> new package id(int)
    op.add_column("k_content_places", sa.Column("package_id_new", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE k_content_places p
        SET package_id_new = kp.id
        FROM k_content_packages kp
        WHERE p.package_id = kp.package_id
        """
    )
    op.alter_column("k_content_places", "package_id_new", nullable=False)

    # 3) switch PK/FK/indexes
    op.execute("DROP INDEX IF EXISTS ix_k_content_places_package_id")
    op.execute("ALTER TABLE k_content_places DROP CONSTRAINT IF EXISTS k_content_places_package_id_fkey")
    op.execute("ALTER TABLE k_content_packages DROP CONSTRAINT IF EXISTS k_content_packages_pkey")
    op.create_primary_key("k_content_packages_pkey", "k_content_packages", ["id"])

    # place_id -> id
    op.alter_column("k_content_places", "place_id", new_column_name="id")
    op.drop_column("k_content_places", "package_id")
    op.alter_column("k_content_places", "package_id_new", new_column_name="package_id")

    op.create_foreign_key(
        "k_content_places_package_id_fkey",
        "k_content_places",
        "k_content_packages",
        ["package_id"],
        ["id"],
    )
    op.create_index("ix_k_content_places_package_id", "k_content_places", ["package_id"])

    # remove old package string key column
    op.drop_column("k_content_packages", "package_id")


def downgrade() -> None:
    # NOTE: original string package_id values are not recoverable once dropped.
    # This downgrade reconstructs synthetic IDs (PKG_<id>) to restore old schema shape.
    op.add_column("k_content_packages", sa.Column("package_id", sa.String(length=50), nullable=True))
    op.execute("UPDATE k_content_packages SET package_id = 'PKG_' || id::text")
    op.alter_column("k_content_packages", "package_id", nullable=False)

    op.add_column("k_content_places", sa.Column("package_id_old", sa.String(length=50), nullable=True))
    op.execute(
        """
        UPDATE k_content_places p
        SET package_id_old = kp.package_id
        FROM k_content_packages kp
        WHERE p.package_id = kp.id
        """
    )

    op.execute("DROP INDEX IF EXISTS ix_k_content_places_package_id")
    op.execute("ALTER TABLE k_content_places DROP CONSTRAINT IF EXISTS k_content_places_package_id_fkey")

    op.alter_column("k_content_places", "id", new_column_name="place_id")
    op.drop_column("k_content_places", "package_id")
    op.alter_column("k_content_places", "package_id_old", new_column_name="package_id")

    op.execute("ALTER TABLE k_content_packages DROP CONSTRAINT IF EXISTS k_content_packages_pkey")
    op.create_primary_key("k_content_packages_pkey", "k_content_packages", ["package_id"])

    op.create_foreign_key(
        "k_content_places_package_id_fkey",
        "k_content_places",
        "k_content_packages",
        ["package_id"],
        ["package_id"],
    )
    op.create_index("ix_k_content_places_package_id", "k_content_places", ["package_id"])

    op.drop_column("k_content_packages", "id")
    op.execute("DROP SEQUENCE IF EXISTS k_content_packages_id_seq")
