from fastapi import APIRouter

from .routes_planner import router as planner_router
from .routes_weather import router as weather_router

v1_router = APIRouter()
v1_router.include_router(planner_router)
v1_router.include_router(weather_router)

__all__ = ["v1_router"]
