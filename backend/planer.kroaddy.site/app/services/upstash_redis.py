"""Upstash Redis REST — L0 보조 캐시 (플래너 gather 등).

- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` 이 설정된 경우에만 동작.
- LangGraph 공식 체크포인터(`RedisSaver`)와는 별도 계층. 서버리스·HTTP만으로 캐시할 때 사용.

문서: https://upstash.com/docs/redis/features/restapi
"""
from __future__ import annotations

import logging
from urllib.parse import quote

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None


def upstash_cache_configured() -> bool:
    u = (settings.upstash_redis_rest_url or "").strip()
    t = (settings.upstash_redis_rest_token or "").strip()
    return bool(u and t)


def _base() -> str:
    return (settings.upstash_redis_rest_url or "").strip().rstrip("/")


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {(settings.upstash_redis_rest_token or '').strip()}"}


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0))
    return _client


async def close_upstash_redis_client() -> None:
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None


async def upstash_get_str(key: str) -> str | None:
    """Redis GET — 값이 없으면 None."""
    if not upstash_cache_configured():
        return None
    k = quote(key, safe="")
    url = f"{_base()}/get/{k}"
    try:
        r = await _http().get(url, headers=_headers())
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.warning("Upstash GET 실패 key=%s: %s", key[:80], e)
        return None
    if isinstance(data, dict) and data.get("error"):
        logger.warning("Upstash GET 오류: %s", data.get("error"))
        return None
    val = data.get("result") if isinstance(data, dict) else None
    if val is None:
        return None
    if not isinstance(val, str):
        return str(val)
    return val


async def upstash_setex_str(key: str, ttl_sec: int, value: str) -> bool:
    """SET + EX — 긴 값은 POST body로 전송 (Upstash REST 규약)."""
    if not upstash_cache_configured():
        return False
    ttl = max(30, min(int(ttl_sec), 86400 * 7))
    k = quote(key, safe="")
    url = f"{_base()}/set/{k}"
    try:
        r = await _http().post(
            url,
            params={"EX": str(ttl)},
            content=value.encode("utf-8"),
            headers={**_headers(), "Content-Type": "text/plain; charset=utf-8"},
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.warning("Upstash SETEX 실패 key=%s: %s", key[:80], e)
        return False
    if isinstance(data, dict) and data.get("error"):
        logger.warning("Upstash SETEX 오류: %s", data.get("error"))
        return False
    return True


async def upstash_delete(key: str) -> None:
    """Redis DEL — 실패해도 예외를 올리지 않는다."""
    if not upstash_cache_configured():
        return
    k = quote(key, safe="")
    url = f"{_base()}/del/{k}"
    try:
        r = await _http().get(url, headers=_headers())
        r.raise_for_status()
    except Exception as e:
        logger.warning("Upstash DEL 실패 key=%s: %s", key[:80], e)
