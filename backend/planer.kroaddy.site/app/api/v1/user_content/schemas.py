"""유저 컨텐츠 API Pydantic 스키마."""
from typing import Optional
from pydantic import BaseModel


class RouteItemInput(BaseModel):
    place: str
    note: Optional[str] = None


class PolishRequest(BaseModel):
    title: str
    location: str
    description: Optional[str] = None
    route_items: list[RouteItemInput]


class PolishedRouteItem(BaseModel):
    order: int
    place: str
    description: str
    tip: str


class PolishResponse(BaseModel):
    title: str
    location: str
    description: str
    route_items: list[PolishedRouteItem]
    tags: list[str]


class SaveRouteRequest(BaseModel):
    user_id: Optional[int] = None
    title: str
    location: str
    description: str
    route_items: list[dict]
    tags: list[str]
    image_data: Optional[str] = None   # base64 인코딩
    image_mime: Optional[str] = None   # e.g. "image/jpeg"


class RouteCardResponse(BaseModel):
    id: int
    user_id: Optional[int]
    title: str
    location: str
    description: str
    route_items: list[dict]
    tags: list[str]
    image_data: Optional[str]
    image_mime: Optional[str]
    likes: int
    created_at: str
