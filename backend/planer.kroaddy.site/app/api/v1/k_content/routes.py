"""K컨텐츠 플래너 API 라우터 – 드라마·영화 촬영지 여행 (준비 중)."""
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/k-content", tags=["k-content"])


@router.get("/health", summary="K컨텐츠 플래너 상태 확인")
async def health():
    return {"status": "coming_soon", "message": "K컨텐츠 플래너는 준비 중입니다."}
