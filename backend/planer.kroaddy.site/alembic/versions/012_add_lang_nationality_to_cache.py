"""add lang_code and nationality to route_cache / schedule_cache

Revision ID: 012
Revises: 011
Create Date: 2026-04-08

국적(nationality)과 언어 코드(lang_code)를 캐시 테이블에 메타 컬럼으로 추가합니다.
cache_key 자체에 lang_code가 이미 포함되어 언어별 캐시를 분리하고 있지만,
나중에 국적/언어별 캐시 통계나 만료 전략을 다르게 적용할 때를 대비해
별도 컬럼으로도 저장합니다.

TTL: 기존 7일(루트) / 30일(일정) → 5일로 통일
     (컬럼이 아닌 애플리케이션 로직에서 관리하므로 DB 변경 없음)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # route_cache
    op.add_column("route_cache", sa.Column("lang_code", sa.String(length=10), nullable=True))
    op.add_column("route_cache", sa.Column("nationality", sa.String(length=50), nullable=True))
    op.create_index("ix_route_cache_location", "route_cache", ["location"], unique=False)

    # schedule_cache
    op.add_column("schedule_cache", sa.Column("lang_code", sa.String(length=10), nullable=True))
    op.add_column("schedule_cache", sa.Column("nationality", sa.String(length=50), nullable=True))
    op.create_index("ix_schedule_cache_location", "schedule_cache", ["location"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_schedule_cache_location", table_name="schedule_cache")
    op.drop_column("schedule_cache", "nationality")
    op.drop_column("schedule_cache", "lang_code")

    op.drop_index("ix_route_cache_location", table_name="route_cache")
    op.drop_column("route_cache", "nationality")
    op.drop_column("route_cache", "lang_code")
