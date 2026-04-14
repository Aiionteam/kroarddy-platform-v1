"""네이버 검색 API – 블로그 검색으로 여행지·맛집 꿀팁 스니펫 수집.

Google Search grounding 대신 규칙 기반 쿼리로 블로그 요약을 모아 LLM 프롬프트에 넣는다.
developers.naver.com – Application > 검색 > 블로그.
"""
from __future__ import annotations

import asyncio
import logging
import re
from html import unescape

import httpx

from app.core.config import settings
from app.core.location_slugs import SLUG_TO_NAME

logger = logging.getLogger(__name__)


def naver_blog_location_token(location_name: str, *, lang: str) -> str:
    """네이버 블로그 검색용 지역 토큰. 한국어 응답(lang=Korean)이면 영문 슬러그를 한글 표기로 바꾼다."""
    raw = (location_name or "").strip()
    if not raw:
        return raw
    if lang != "Korean":
        return raw
    if any("\uac00" <= c <= "\ud7a3" for c in raw):
        return raw
    key = raw.lower().replace(" ", "-")
    return SLUG_TO_NAME.get(key, raw)

_NAVER_BLOG_URL = "https://openapi.naver.com/v1/search/blog.json"

_naver_search_client = httpx.AsyncClient(
    timeout=httpx.Timeout(connect=3.0, read=8.0, write=3.0, pool=1.0),
    limits=httpx.Limits(max_connections=20, max_keepalive_connections=8, keepalive_expiry=20),
)


async def close_naver_search_client() -> None:
    if not _naver_search_client.is_closed:
        await _naver_search_client.aclose()


def _strip_html(s: str) -> str:
    t = re.sub(r"<[^>]+>", "", s or "")
    return unescape(t).replace("&nbsp;", " ").strip()


def naver_search_configured() -> bool:
    return bool(
        (settings.naver_search_client_id or "").strip()
        and (settings.naver_search_client_secret or "").strip()
    )


async def naver_blog_search(query: str, *, display: int = 5) -> list[dict[str, str]]:
    """블로그 검색 → 제목·요약 스니펫 리스트."""
    if not naver_search_configured():
        return []
    q = (query or "").strip()
    if not q:
        return []
    n = max(1, min(int(display), 10))
    headers = {
        "X-Naver-Client-Id": settings.naver_search_client_id.strip(),
        "X-Naver-Client-Secret": settings.naver_search_client_secret.strip(),
    }
    params = {"query": q, "display": str(n), "sort": "sim"}
    try:
        resp = await _naver_search_client.get(_NAVER_BLOG_URL, params=params, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.warning("네이버 블로그 검색 오류 (query=%s): %s", q[:80], e)
        return []

    out: list[dict[str, str]] = []
    for it in data.get("items") or []:
        title = _strip_html(it.get("title", ""))
        desc = _strip_html(it.get("description", ""))
        if not title and not desc:
            continue
        out.append({"title": title, "description": desc[:400]})
    return out


def naver_tips_queries(*, location_name: str, route_name: str, lang: str) -> list[str]:
    """규칙 기반 검색어 – 지역·루트별 고정 패턴."""
    loc = naver_blog_location_token(location_name, lang=lang)
    rn = (route_name or "").strip()
    if not loc:
        return []
    is_ko = lang == "Korean" or any("\uac00" <= c <= "\ud7a3" for c in loc)
    if is_ko:
        qs = [
            f"{loc} 여행 꿀팁",
            f"{loc} 맛집 추천",
            f"{loc} 가볼만한곳",
        ]
        if rn and rn not in ("(없음)", "(none)"):
            qs.append(f"{loc} {rn}"[:100])
        return qs[:4]
    return [
        f"{loc} travel tips Korea",
        f"{loc} restaurants recommended",
        f"{loc} things to do",
    ]


async def build_naver_tips_raw_text(
    *,
    location_name: str,
    route_name: str,
    lang: str,
    extra_queries: list[str] | None = None,
    max_chars: int = 2200,
    per_query_display: int = 4,
) -> str:
    """여러 쿼리를 병렬로 검색하고 중복·길이 제한된 본문 한 덩어리로 합친다."""
    if not naver_search_configured():
        return ""

    queries = naver_tips_queries(location_name=location_name, route_name=route_name, lang=lang)
    if extra_queries:
        for q in extra_queries:
            qq = (q or "").strip()
            if not qq:
                continue
            if qq not in queries:
                queries.append(qq)
    # 너무 많은 쿼리는 지연/토큰만 늘리므로 상위 8개 제한
    queries = queries[:8]
    if not queries:
        return ""

    async def _one(q: str) -> list[dict[str, str]]:
        return await naver_blog_search(q, display=per_query_display)

    try:
        groups = await asyncio.gather(*[_one(q) for q in queries])
    except Exception as e:
        logger.warning("네이버 팁 수집 실패: %s", e)
        return ""

    seen: set[str] = set()
    lines: list[str] = []
    for rows in groups:
        for row in rows:
            blob = f"{row.get('title', '')} {row.get('description', '')}".strip()
            key = re.sub(r"\s+", "", blob.lower())[:200]
            if not blob or key in seen:
                continue
            seen.add(key)
            line = row.get("title", "")
            if row.get("description"):
                line = f"{line}: {row['description']}" if line else row["description"]
            if len(line) > 280:
                line = line[:277] + "…"
            lines.append(f"• {line}")

    body = "\n".join(lines)
    if len(body) > max_chars:
        body = body[:max_chars] + "\n…(생략)"
    return body
