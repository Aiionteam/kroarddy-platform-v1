from typing import Optional, TypedDict


class PlannerState(TypedDict):
    """LangGraph 상태 - 루트 추천 및 일정 생성 공통."""

    location: str            # URL 슬러그 (예: seoul)
    location_name: str       # 한글 지명 (예: 서울)
    route_name: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    routes: list             # generate_routes 결과
    schedule: list           # generate_schedule 결과
    error: Optional[str]
    festivals: list          # 여행 기간 내 해당 지역 행사 목록 (festival 서비스에서 조회)
    user_profile: Optional[dict]  # 사용자 여행 성향 (user_info 서비스에서 조회)
    existing_routes: Optional[list]  # 이미 저장된 루트명 목록 (AI가 중복 제외)
