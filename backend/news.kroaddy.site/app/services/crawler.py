"""뉴스 크롤러 – 한국 문화/연예 RSS 피드에서 K-콘텐츠 뉴스 수집."""
import asyncio
import logging
import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

import feedparser
import httpx

logger = logging.getLogger(__name__)

# ─── 문화/연예 RSS 피드만 ─────────────────────────────────────────
RSS_FEEDS: dict[str, list[str]] = {
    "culture": [
        "https://www.yna.co.kr/rss/entertainment.xml",          # 연합뉴스 연예
        "https://www.yna.co.kr/rss/culture.xml",                # 연합뉴스 문화
        "https://www.khan.co.kr/rss/rssdata/culture_news.xml",  # 경향신문 문화
        "https://rss.etnews.com/Section901.xml",                 # ETNews 연예
        "https://www.hani.co.kr/rss/culture/entertainment/index.rss",  # 한겨레 방송/연예
        "https://www.hani.co.kr/rss/culture/music/index.rss",          # 한겨레 음악/공연/전시
        "https://www.hani.co.kr/rss/culture/movie/index.rss",          # 한겨레 영화
        "https://www.hani.co.kr/rss/culture/leisure/index.rss",        # 한겨레 여행/여가
    ],
}

CATEGORY_LABELS: dict[str, str] = {
    "culture": "문화/연예",
}

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "ko-KR,ko;q=0.9",
}

_CACHE: dict[str, tuple[list[dict], float]] = {}
_CACHE_TTL = 15 * 60
_CACHE_LOCKS: dict[str, asyncio.Lock] = {cat: asyncio.Lock() for cat in RSS_FEEDS}


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "").strip()


def _parse_published(entry: Any) -> str:
    try:
        if hasattr(entry, "published"):
            dt = parsedate_to_datetime(entry.published)
            return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        pass
    return datetime.now(timezone.utc).isoformat()


def _extract_thumbnail(entry: Any) -> str | None:
    media_thumbnail = getattr(entry, "media_thumbnail", None)
    if media_thumbnail and isinstance(media_thumbnail, list):
        url = media_thumbnail[0].get("url")
        if url:
            return url
    media_content = getattr(entry, "media_content", None)
    if media_content and isinstance(media_content, list):
        for mc in media_content:
            if mc.get("type", "").startswith("image"):
                return mc.get("url")
    summary = getattr(entry, "summary", "") or ""
    m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary)
    if m:
        return m.group(1)
    return None


def _entry_to_item(entry: Any, source_name: str) -> dict:
    return {
        "title":     _strip_html(getattr(entry, "title", "")),
        "link":      getattr(entry, "link", ""),
        "summary":   _strip_html(getattr(entry, "summary", ""))[:300],
        "source":    source_name,
        "published": _parse_published(entry),
        "thumbnail": _extract_thumbnail(entry),
    }


def _fetch_og_image_sync(url: str) -> str | None:
    """기사 URL에서 og:image 메타태그 추출."""
    try:
        with httpx.Client(timeout=5.0, headers=_BROWSER_HEADERS, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            html = resp.text[:30000]  # 앞부분만 파싱
        # property="og:image" content="..." 또는 반대 순서
        m = re.search(
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', html
        ) or re.search(
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', html
        )
        if m:
            img = m.group(1).strip()
            return img if img.startswith("http") else None
    except Exception:
        pass
    return None


async def enrich_og_images(items: list[dict], max_concurrent: int = 5) -> list[dict]:
    """썸네일 없는 기사의 og:image를 비동기 병렬로 보충."""
    sem = asyncio.Semaphore(max_concurrent)
    loop = asyncio.get_event_loop()

    async def _fetch_one(item: dict) -> None:
        if item.get("thumbnail"):
            return
        async with sem:
            img = await loop.run_in_executor(None, _fetch_og_image_sync, item["link"])
            if img:
                item["thumbnail"] = img

    await asyncio.gather(*[_fetch_one(item) for item in items])
    return items


def _fetch_feed_sync(url: str) -> list[dict]:
    try:
        with httpx.Client(timeout=10.0, headers=_BROWSER_HEADERS, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            content = resp.content
    except Exception as e:
        logger.warning("RSS fetch 실패: %s → %s", url, e)
        return []

    feed = feedparser.parse(content)
    source_name = feed.feed.get("title", url.split("/")[2]) if feed.feed else url.split("/")[2]

    items = []
    for entry in feed.entries[:15]:
        item = _entry_to_item(entry, source_name)
        if item["title"] and item["link"]:
            items.append(item)
    return items


def _fetch_category_sync(category: str) -> list[dict]:
    urls = RSS_FEEDS.get(category, [])
    all_items: list[dict] = []
    seen_links: set[str] = set()

    for url in urls:
        items = _fetch_feed_sync(url)
        for item in items:
            if item["link"] not in seen_links:
                seen_links.add(item["link"])
                all_items.append(item)

    all_items.sort(key=lambda x: x["published"], reverse=True)
    return all_items


async def get_news(category: str = "culture", limit: int = 20) -> list[dict]:
    if category not in RSS_FEEDS:
        category = "culture"

    cached = _CACHE.get(category)
    if cached and time.time() < cached[1]:
        return cached[0][:limit]

    lock = _CACHE_LOCKS.get(category)
    if lock is None:
        lock = asyncio.Lock()
        _CACHE_LOCKS[category] = lock

    if lock.locked() and category in _CACHE and _CACHE[category][0]:
        return _CACHE[category][0][:limit]

    async with lock:
        cached = _CACHE.get(category)
        if cached and time.time() < cached[1]:
            return cached[0][:limit]

        try:
            loop = asyncio.get_event_loop()
            items = await loop.run_in_executor(None, _fetch_category_sync, category)
            _CACHE[category] = (items, time.time() + _CACHE_TTL)
            logger.info("뉴스 캐시 갱신: category=%s, %d건", category, len(items))
        except Exception as e:
            logger.error("뉴스 조회 실패: %s", e)
            if category in _CACHE:
                return _CACHE[category][0][:limit]
            return []

    return _CACHE.get(category, ([], 0))[0][:limit]


async def warmup() -> None:
    try:
        await get_news("culture", limit=50)
        logger.info("뉴스 캐시 워밍 완료")
    except Exception as e:
        logger.warning("뉴스 캐시 워밍 실패: %s", e)
