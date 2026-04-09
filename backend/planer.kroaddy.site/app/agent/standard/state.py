from typing import Optional, TypedDict


class PlannerState(TypedDict):
    """LangGraph 상태 - 루트 추천 및 일정 생성 공통."""

    # ── 요청 파라미터 ─────────────────────────────────────────────────────────
    location: str            # URL 슬러그 (예: seoul)
    location_name: str       # 한글 지명 (예: 서울)
    user_id: Optional[str]   # 유저 ID – gather_context_node에서 프로필 조회에 사용
    route_name: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    transport_mode: Optional[str]    # "car" | "transit" | "walk"
    use_search: bool                 # True: Google Search grounding 사용

    # ── 수집 데이터 (gather_context_node → generate_schedule_node) ────────────
    user_profile: Optional[dict]     # 사용자 여행 성향 (user_info 서비스)
    festivals: list                  # 여행 기간 내 행사 목록
    news_top10: Optional[list]       # K-콘텐츠 뉴스 Top10
    weather_forecast: Optional[dict] # OpenWeatherMap 날씨 예보
    web_search_context: Optional[str]  # Google Search grounding으로 수집한 최신 텍스트
    # gather_context_node에서 use_search=True로 웹 검색을 이미 시도했으면 True (실패 시 재호출 방지)
    web_search_gather_attempted: Optional[bool]

    # ── 생성 결과 ────────────────────────────────────────────────────────────
    routes: list             # generate_routes 결과
    schedule: list           # generate_schedule 결과
    cost_summary: Optional[dict]     # {"per_day":[...],"trip_total":"₩N"}
    error: Optional[str]

    # ── 루트 생성 전용 ────────────────────────────────────────────────────────
    existing_routes: Optional[list]  # 이미 저장된 루트명 목록 (중복 제외용)
