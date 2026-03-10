"""보안 유틸리티 – JWT 검증 / 비밀번호 해싱 등."""
from __future__ import annotations

from app.core.config import settings


def get_secret_key() -> str:
    """설정에서 시크릿 키를 반환합니다."""
    return getattr(settings, "secret_key", "")
