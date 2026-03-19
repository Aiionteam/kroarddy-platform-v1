"""LangGraph 그래프 정의 – K-Content 하이브리드 일정 에이전트."""

from langgraph.graph import END, StateGraph

from app.agent.k_content.nodes import fetch_k_content_node, generate_k_schedule_node
from app.agent.k_content.state import KContentState


def _build_k_content_graph():
    """START → fetch_k_content_node → generate_k_schedule_node → END."""
    g = StateGraph(KContentState)
    g.add_node("fetch_k_content", fetch_k_content_node)
    g.add_node("generate_k_schedule", generate_k_schedule_node)

    g.set_entry_point("fetch_k_content")
    g.add_edge("fetch_k_content", "generate_k_schedule")
    g.add_edge("generate_k_schedule", END)
    return g.compile()


k_content_graph = _build_k_content_graph()
