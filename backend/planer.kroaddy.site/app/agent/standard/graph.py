"""LangGraph 그래프 정의 – Standard 플래너."""
from langgraph.graph import END, StateGraph

from app.agent.standard.nodes_routes import generate_routes
from app.agent.standard.nodes_schedule import (
    enrich_business_hours_schedule,
    gather_context_node,
    generate_schedule,
    geocode_schedule,
)
from app.agent.standard.state import PlannerState


def _build_routes_graph():
    """루트 추천 그래프: START → generate_routes → END.

    외부 API 호출 없이 순수 LLM으로 7개 테마 루트를 빠르게 생성한다.
    행사/뉴스는 일정 생성 단계(gather_context_node)에서 반영된다.
    """
    g = StateGraph(PlannerState)
    g.add_node("generate_routes", generate_routes)
    g.set_entry_point("generate_routes")
    g.add_edge("generate_routes", END)
    return g.compile()


def build_schedule_graph(*, checkpointer=None):
    """일정 생성 그래프 (LangGraph 멀티 노드).

    gather_context  : 프로필·행사·뉴스·날씨 1차 병렬 → 웹검색+카카오 POI 2차 병렬 (L1/L2 Neon 캐시 정책 유지)
    generate_schedule: 수집된 컨텍스트 기반 Day별 순차 LLM 일정 생성(교차 일차 exclude)
    geocode_schedule : 네이버 API로 장소 좌표 검증·보강 (병렬)
    enrich_business_hours: (옵션) 네이버 플레이스 영업시간 크롤

    ``checkpointer``가 있으면 ``thread_id``(invoke config)별로 노드 단위 상태가 Redis에 저장되어
    동일 ``thread_id``로 재호출 시 마지막 체크포인트부터 이어갈 수 있다.
    """
    g = StateGraph(PlannerState)
    g.add_node("gather_context", gather_context_node)
    g.add_node("generate_schedule", generate_schedule)
    g.add_node("geocode_schedule", geocode_schedule)
    g.add_node("enrich_business_hours", enrich_business_hours_schedule)

    g.set_entry_point("gather_context")
    g.add_edge("gather_context", "generate_schedule")
    g.add_edge("generate_schedule", "geocode_schedule")
    g.add_edge("geocode_schedule", "enrich_business_hours")
    g.add_edge("enrich_business_hours", END)
    return g.compile(checkpointer=checkpointer)


routes_graph = _build_routes_graph()
# 기본은 무체크포인트; lifespan에서 Redis 초기화 성공 시 교체된다.
schedule_graph = build_schedule_graph()
