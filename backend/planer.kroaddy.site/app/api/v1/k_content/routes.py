"""K컨텐츠 플래너 API 라우터 – K-Content 하이브리드 일정 생성."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agent.k_content.graph import k_content_graph

router = APIRouter(prefix="/api/v1/k-content", tags=["k-content"])


class KContentGenerateRequest(BaseModel):
    package_id: str
    # Standard과 동일하게 날짜 문자열을 사용(YYYY-MM-DD). 없으면 기본값 사용.
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    # agent prompt의 Destination으로 사용. 없으면 빈 문자열로 동작할 수 있음.
    location_name: Optional[str] = None
    user_profile: Optional[Dict[str, Any]] = None


@router.get("/health", summary="K컨텐츠 플래너 상태 확인")
async def health():
    return {"status": "ok"}


@router.post("/generate", summary="K-Content 하이브리드 일정 생성")
async def generate_k_itinerary(req: KContentGenerateRequest):
    try:
        # LangGraph State: KContentState(KContent agent)에서 필요한 키만 넣습니다.
        initial_state = {
            "package_id": req.package_id,
            "location_name": req.location_name or "",
            "location": req.location_name or "",
            "start_date": req.start_date,
            "end_date": req.end_date,
            "user_profile": req.user_profile or {},
        }

        result = await k_content_graph.ainvoke(initial_state)

        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])

        return {
            "success": True,
            "package_meta": result.get("package_meta"),
            "schedule": result.get("schedule"),
            # DB 앵커 + Gemini 외부 추천을 합친 최종 장소 목록
            "places": result.get("places"),
            "external_places": result.get("external_places"),
            "cost_summary": result.get("cost_summary"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent Error: {str(e)}")
