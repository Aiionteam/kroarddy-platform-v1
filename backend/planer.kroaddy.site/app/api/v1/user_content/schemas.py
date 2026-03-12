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


class PresignedUrlRequest(BaseModel):
    content_type: str  # e.g. "image/jpeg"


class PresignedUrlResponse(BaseModel):
    upload_url: str   # S3 presigned PUT URL
    image_url: str    # 업로드 후 DB에 저장할 공개 URL


class ValidateImageResponse(BaseModel):
    is_safe: bool
    nsfw_score: float          # 0.0 ~ 1.0 (참고용)
    upload_url: str            # S3 presigned PUT URL (안전할 때만)
    image_url: str             # DB 저장용 공개 URL (안전할 때만)


class SaveRouteRequest(BaseModel):
    user_id: Optional[int] = None
    title: str
    location: str
    description: str
    route_items: list[dict]
    tags: list[str]
    image_url: Optional[str] = None   # S3 공개 URL


class RouteCardResponse(BaseModel):
    id: int
    user_id: Optional[int]
    title: str
    location: str
    description: str
    route_items: list[dict]
    tags: list[str]
    image_url: Optional[str]
    likes: int
    created_at: str
