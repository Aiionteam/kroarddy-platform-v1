from fastapi import APIRouter

from .standard.routes import router as standard_router
from .k_content.routes import router as k_content_router
from .user_content.routes import router as user_content_router
from .routes_weather import router as weather_router

v1_router = APIRouter()
v1_router.include_router(standard_router)
v1_router.include_router(k_content_router)
v1_router.include_router(user_content_router)
v1_router.include_router(weather_router)

__all__ = ["v1_router"]
