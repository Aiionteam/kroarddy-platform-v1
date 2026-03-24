from __future__ import annotations

from typing import Optional, TypedDict

from app.agent.standard.state import PlannerState


class KContentPlaceInfo(TypedDict, total=False):
    """DB 또는 Gemini 검색 결과에서 들어오는 장소 정보(정규화된 형태)."""

    # DB id는 nullable 가능(외부 추천은 없을 수 있음)
    id: Optional[int]
    name_en: str
    name_ko: Optional[str]
    lat: float
    lng: float
    description_en: Optional[str]
    must_do_en: Optional[str]
    # 어디서 왔는지(최종 합본용)
    source: str  # "db" | "external"


class KContentState(PlannerState, total=False):
    """K-콘텐츠 일정 에이전트용 상태.

    PlannerState(공통 필드)를 그대로 쓰되, K-content 전용 필드를 추가합니다.
    """

    package_id: int

    # DB에서 읽어온 필수 앵커(반드시 일정에 포함해야 하는 장소들)
    db_places: list[KContentPlaceInfo]

    # Gemini Search(grounding)로 추가로 추천된 장소들
    external_places: list[KContentPlaceInfo]

    # db_places + external_places 를 합친 최종 장소 목록(상태 전달/추적용)
    places: list[KContentPlaceInfo]

    # 패키지 메타(선택)
    package_meta: dict
