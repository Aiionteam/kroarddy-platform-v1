"""LangGraph 그래프 정의 – K-Content 하이브리드 일정 에이전트."""

from langgraph.graph import END, StateGraph

from app.agent.k_content.nodes import (
    _is_kf_cafe_mode,
    fetch_k_content_node,
    generate_cafe_tour_node,
    generate_k_schedule_node,
)
from app.agent.k_content.state import KContentState


def _route_after_fetch(state: KContentState) -> str:
    """KF_CAFE는 카페 감성 전용 노드, 그 외는 기존 하이브리드 일정 노드."""
    pm = state.get("package_meta") or {}
    leg = state.get("legacy_package_ref")
    if _is_kf_cafe_mode(pm, leg):
        return "cafe_tour"
    return "k_schedule"


def _build_k_content_graph():
    """START → fetch → (KF_CAFE → generate_cafe_tour | else → generate_k_schedule) → END."""
    g = StateGraph(KContentState)
    g.add_node("fetch_k_content", fetch_k_content_node)
    g.add_node("generate_cafe_tour", generate_cafe_tour_node)
    g.add_node("generate_k_schedule", generate_k_schedule_node)

    g.set_entry_point("fetch_k_content")
    g.add_conditional_edges(
        "fetch_k_content",
        _route_after_fetch,
        {
            "cafe_tour": "generate_cafe_tour",
            "k_schedule": "generate_k_schedule",
        },
    )
    g.add_edge("generate_cafe_tour", END)
    g.add_edge("generate_k_schedule", END)
    return g.compile()


k_content_graph = _build_k_content_graph()
