"""SQLAlchemy 모델 – K-콘텐츠 패키지/장소."""

from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base


class KContentPackage(Base):
    __tablename__ = "k_content_packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # KPOP, DRAMA, MOVIE ...
    category: Mapped[str] = mapped_column(String(20), nullable=False)

    title_en: Mapped[str] = mapped_column(String(255), nullable=False)
    title_ko: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tags: Mapped[str | None] = mapped_column(String(255), nullable=True)

    places: Mapped[list["KContentPlace"]] = relationship(
        "KContentPlace",
        back_populates="package",
        cascade="all, delete-orphan",
    )


class KContentPlace(Base):
    __tablename__ = "k_content_places"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    package_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("k_content_packages.id"),
        nullable=True,
    )

    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_ko: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lat: Mapped[float] = mapped_column(Numeric(10, 8), nullable=False)
    lng: Mapped[float] = mapped_column(Numeric(11, 8), nullable=False)
    description_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    must_do_en: Mapped[str | None] = mapped_column(Text, nullable=True)

    package: Mapped["KContentPackage"] = relationship("KContentPackage", back_populates="places")
