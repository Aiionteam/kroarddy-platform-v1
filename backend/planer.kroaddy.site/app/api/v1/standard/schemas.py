"""Standard 플래너 API 요청/응답 Pydantic 스키마."""
from typing import Any, Optional

from pydantic import BaseModel


class RoutesRequest(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    user_id: Optional[int] = None
    existing_routes: Optional[list[str]] = None
    use_search: bool = False  # True: Google Search grounding 사용 (느리지만 정확)
    news_top10: Optional[list[Any]] = None  # 프론트에서 전달한 뉴스 Top10 (없으면 직접 fetch)
    transport_mode: Optional[str] = None  # "car" | "transit" | "walk"


class ScheduleRequest(BaseModel):
    route_name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    user_id: Optional[int] = None
    use_search: bool = False  # True: Google Search grounding 사용
    news_top10: Optional[list[Any]] = None  # 프론트에서 전달한 뉴스 Top10 (없으면 직접 fetch)
    transport_mode: Optional[str] = None  # "car" | "transit" | "walk"
    # 동일 값으로 재요청 시: LangGraph Redis 체크포인트 / SSE gather 맥락(Upstash) 재개
    thread_id: Optional[str] = None


class SavePlanRequest(BaseModel):
    location: str
    route_name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    schedule: list[Any]
    user_id: Optional[int] = None


class ModifyRequest(BaseModel):
    instruction: str
    user_id: Optional[int] = None


class RerollItemRequest(BaseModel):
    item_index: int
    user_id: Optional[int] = None
