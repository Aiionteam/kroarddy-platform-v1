"""일정 LangGraph용 Redis 체크포인터 생명주기.

``LANGGRAPH_REDIS_URL``(TCP, 예: ``rediss://default:...@...upstash.io:6379``)이 설정되면
``langgraph-checkpoint-redis``의 ``AsyncRedisSaver``로 그래프를 다시 컴파일한다.

주의: 공식 패키지는 RedisJSON·RediSearch(또는 Redis 8+)를 요구한다. Upstash 등에서
``asetup()`` 실패 시 무체크포인트 그래프로 폴백한다.
"""
from __future__ import annotations

import logging
from urllib.parse import urlparse

from app.agent.standard import graph as std_graph
from app.core.config import settings

logger = logging.getLogger(__name__)

_cm: object | None = None
_checkpointer: object | None = None


def _langgraph_redis_is_upstash_incompatible(url: str) -> bool:
    """``langgraph-checkpoint-redis`` 는 RediSearch(``FT.*``) 초기화가 필요하다.

    Upstash Redis는 해당 명령을 제공하지 않아 ``asetup()`` 이 항상 실패한다.
    https://upstash.com/docs/redis/overall/rediscompatibility
    """
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False
    return "upstash.io" in host


async def init_schedule_graph_checkpoint() -> None:
    global _cm, _checkpointer
    url = (settings.langgraph_redis_url or "").strip()
    if not url:
        logger.info("LANGGRAPH_REDIS_URL 미설정 — 일정 그래프는 체크포인트 없이 동작합니다.")
        return
    if _langgraph_redis_is_upstash_incompatible(url):
        logger.info(
            "LANGGRAPH_REDIS_URL 가 Upstash 호스트입니다. LangGraph RedisSaver는 RediSearch가 "
            "필요해 Upstash와 맞지 않아 체크포인트를 쓰지 않습니다. "
            "(Upstash REST 캐시·비동기 job 등은 기존대로 동작)",
        )
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
        err = str(e)
        # RediSearch 미지원·엔진 제한은 흔한 케이스 → WARNING 대신 INFO
        _soft = (
            "FT." in err
            or "RediSearch" in err
            or "not available" in err.lower()
            or "rediscompatibility" in err.lower()
        )
        log = logger.info if _soft else logger.warning
        log(
            "Redis LangGraph 체크포인터 초기화 실패 — 무상태로 계속: %s",
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
