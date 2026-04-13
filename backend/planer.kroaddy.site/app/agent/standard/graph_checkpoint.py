"""일정 LangGraph용 Redis 체크포인터 생명주기.

``LANGGRAPH_REDIS_URL``(TCP, 예: ``rediss://default:...@...upstash.io:6379``)이 설정되면
``langgraph-checkpoint-redis``의 ``AsyncRedisSaver``로 그래프를 다시 컴파일한다.

주의: 공식 패키지는 RedisJSON·RediSearch(또는 Redis 8+)를 요구한다. Upstash 등에서
``asetup()`` 실패 시 무체크포인트 그래프로 폴백한다.
"""
from __future__ import annotations

import logging

from app.agent.standard import graph as std_graph
from app.core.config import settings

logger = logging.getLogger(__name__)

_cm: object | None = None
_checkpointer: object | None = None


async def init_schedule_graph_checkpoint() -> None:
    global _cm, _checkpointer
    url = (settings.langgraph_redis_url or "").strip()
    if not url:
        logger.info("LANGGRAPH_REDIS_URL 미설정 — 일정 그래프는 체크포인트 없이 동작합니다.")
        return
    try:
        from langgraph.checkpoint.redis.aio import AsyncRedisSaver
    except ImportError:
        logger.warning(
            "langgraph-checkpoint-redis 미설치 — pip install langgraph-checkpoint-redis 후 재시작하세요."
        )
        return
    try:
        _cm = AsyncRedisSaver.from_conn_string(url)
        _checkpointer = await _cm.__aenter__()  # type: ignore[union-attr]
        await _checkpointer.asetup()  # type: ignore[union-attr]
    except Exception as e:
        logger.warning(
            "Redis LangGraph 체크포인터 초기화 실패(모듈 미지원·URL 오류 등) — 무상태로 계속: %s",
            e,
        )
        if _cm is not None:
            try:
                await _cm.__aexit__(type(e), e, e.__traceback__)  # type: ignore[union-attr]
            except Exception:
                try:
                    await _cm.__aexit__(None, None, None)  # type: ignore[union-attr]
                except Exception:
                    pass
        _cm = None
        _checkpointer = None
        return
    std_graph.schedule_graph = std_graph.build_schedule_graph(checkpointer=_checkpointer)
    logger.info("일정 LangGraph Redis 체크포인터 활성화")


async def close_schedule_graph_checkpoint() -> None:
    global _cm, _checkpointer
    if _cm is not None:
        try:
            await _cm.__aexit__(None, None, None)  # type: ignore[union-attr]
        except Exception as e:
            logger.warning("Redis 체크포인터 종료 중 경고: %s", e)
    _cm = None
    _checkpointer = None
    std_graph.schedule_graph = std_graph.build_schedule_graph()


def schedule_checkpoint_active() -> bool:
    return _checkpointer is not None
