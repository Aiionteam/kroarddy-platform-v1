"""Standard 플래너 API 요청/응답 Pydantic 스키마."""
from typing import Any, Optional

from pydantic import BaseModel


class RoutesRequest(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    user_id: Optional[int] = None
    existing_routes: Optional[list[str]] = None


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
    item_index: int
    user_id: Optional[int] = None
