"""LangGraph 그래프 정의 – Standard 플래너."""
from langgraph.graph import END, StateGraph

from app.agent.standard.nodes import generate_routes, generate_schedule
from app.agent.standard.state import PlannerState


def _build_routes_graph():
    """루트 추천 그래프: START → generate_routes → END."""
    g = StateGraph(PlannerState)
    g.add_node("generate_routes", generate_routes)
    g.set_entry_point("generate_routes")
    g.add_edge("generate_routes", END)
    return g.compile()


def _build_schedule_graph():
    """일정 생성 그래프: START → generate_schedule → END."""
    g = StateGraph(PlannerState)
    g.add_node("generate_schedule", generate_schedule)
    g.set_entry_point("generate_schedule")
    g.add_edge("generate_schedule", END)
    return g.compile()


routes_graph = _build_routes_graph()
schedule_graph = _build_schedule_graph()
