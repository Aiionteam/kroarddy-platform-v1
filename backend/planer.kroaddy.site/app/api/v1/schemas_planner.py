"""플래너 API 요청/응답 Pydantic 스키마."""
from typing import Any, Optional

from pydantic import BaseModel


class RoutesRequest(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    user_id: Optional[int] = None           # 개인화 루트 추천용
    existing_routes: Optional[list[str]] = None  # 이미 저장된 루트명 목록 (중복 제외용)


class ScheduleRequest(BaseModel):
    route_name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None


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
    item_index: int          # 전체 schedule 배열에서의 인덱스
    user_id: Optional[int] = None
