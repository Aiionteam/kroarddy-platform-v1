"""K-Content API 요청/응답 스키마 및 ID 변환 유틸."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

KContentCategory = Literal["KPOP", "KDRAMA", "KMOVIE"]


def build_legacy_package_id(*, db_id: int, category: str) -> str:
    """DB int id + category를 프런트 호환 string package_id로 변환."""
    cat = (category or "").upper()
    if cat == "KPOP":
        return f"KPOP_{db_id:02d}"
    if cat in {"KDRAMA", "KMOVIE"}:
        # 현재 데이터셋 규칙: id 9..20 -> KD_01..12
        return f"KD_{max(1, db_id - 8):02d}"
    return f"PKG_{db_id:02d}"


def parse_package_ref_to_db_id(package_ref: int | str) -> int | None:
    """string/int package ref를 DB int id로 정규화."""
    if isinstance(package_ref, int):
        return package_ref

    ref = (package_ref or "").strip().upper()
    if not ref:
        return None
    if ref.isdigit():
        return int(ref)

    if ref.startswith("KPOP_"):
        num = ref.replace("KPOP_", "", 1)
        return int(num) if num.isdigit() else None

    if ref.startswith("KD_"):
        num = ref.replace("KD_", "", 1)
        if not num.isdigit():
            return None
        return int(num) + 8

    return None


class KContentGenerateRequest(BaseModel):
    package_id: int | str
    start_date: str | None = None
    end_date: str | None = None
    location_name: str | None = None
    user_profile: dict[str, Any] | None = None
    news_top10: list[Any] | None = None


class KContentSaveRequest(BaseModel):
    package_meta: dict[str, Any]
    schedule: list[dict[str, Any]]
    places: list[dict[str, Any]] | None = None
    cost_summary: dict[str, Any] | None = None
    user_id: int | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None


class KContentPlaceResponse(BaseModel):
    id: int
    package_id: int | None = None
    name_en: str
    name_ko: str | None = None
    lat: float
    lng: float
    # DB Text 컬럼을 그대로 수용 (길이 제한 없음)
    description_en: str | None = None
    must_do_en: str | None = None


class KContentPackageResponse(BaseModel):
    # DB PK
    id: int
    # 프런트 호환 string 식별자 (KPOP_01 / KD_12)
    package_id: str
    category: str
    title_en: str
    title_ko: str | None = None
    # DB Text 컬럼을 그대로 수용 (길이 제한 없음)
    description_en: str | None = None
    image_url: str | None = None
    tags: str | None = None
    places: list[KContentPlaceResponse] = Field(default_factory=list)


class KContentPackagesListResponse(BaseModel):
    items: list[KContentPackageResponse]
    total: int
