"""네이버 플레이스 영업시간 수집 – Playwright 순수 크롤링.

API 키 불필요. 장소명 → 네이버 지도 검색 → place_id 파싱 → 상세 페이지 영업시간 추출.
네이버 UI 변경 시 셀렉터가 깨질 수 있으므로 주기적 점검 권장.
"""
from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_MAX_HOURS_LEN = 600
_DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# 네이버 지도 검색 결과 URL에 포함된 place id 패턴
_PLACE_ID_RE = re.compile(r"/place/(\d{5,})")


def _normalize_hours_text(raw: str) -> str:
    s = " ".join(raw.split())
    return s[:_MAX_HOURS_LEN] if len(s) > _MAX_HOURS_LEN else s


def _search_place_id_sync(page: Any, place_name: str, timeout: int) -> str | None:
    """네이버 지도 검색 결과 페이지에서 첫 번째 place_id를 추출한다."""
    search_url = f"https://map.naver.com/v5/search/{re.sub(r'[?#]', '', place_name)}"
    try:
        page.goto(search_url, wait_until="domcontentloaded", timeout=timeout)
        time.sleep(1.2)

        # 검색 결과 목록 사이드패널 내 첫 번째 장소 링크에서 place id 파싱
        for sel in (
            "ul.search_list li a[href*='/place/']",
            "a[href*='/place/']",
        ):
            try:
                locs = page.locator(sel)
                if locs.count() > 0:
                    href = locs.first.get_attribute("href", timeout=3000)
                    if href:
                        m = _PLACE_ID_RE.search(href)
                        if m:
                            return m.group(1)
            except Exception:
                continue

        # fallback: URL 자체가 place 페이지로 리다이렉트된 경우
        current_url = page.url
        m = _PLACE_ID_RE.search(current_url)
        if m:
            return m.group(1)

    except Exception as e:
        logger.debug("place_id 검색 실패 (%s): %s", place_name, e)

    return None


def _try_expand_hours(page: Any) -> None:
    """영업시간 꺽새(chevron) 클릭 – 여러 전략을 순서대로 시도한다.

    네이버 플레이스 상세 페이지의 영업시간 옆 '∨' 아이콘은 텍스트가 없는
    아이콘 버튼이므로 텍스트 기반 탐색으로는 잡히지 않는다.
    아래 전략들을 순서대로 시도하며 하나라도 성공하면 반환한다.
    """
    # 전략 1: 영업시간 행 안에 있는 버튼/클릭 요소 직접 탐색
    # pcmap 기준으로 영업시간 아이콘 행은 div[data-id='hours'] 또는
    # aria-label에 '영업시간' 포함한 li/div 안에 button 이 있음
    chevron_selectors = [
        # aria 기반 (가장 안정적)
        "button[aria-label*='영업시간']",
        "button[aria-expanded='false']",
        # 클래스 기반 (예제 코드 원본)
        "._rvS6",
        # 영업시간 텍스트 형제/자식 버튼
        "li:has-text('영업') button",
        "div:has-text('영업시간') button",
        # 시계 아이콘 옆 chevron (svg 포함 버튼)
        "span.place_section_content button",
        ".place_detail_section button[class*='more']",
        ".place_detail_section button[class*='More']",
    ]
    for sel in chevron_selectors:
        try:
            loc = page.locator(sel)
            if loc.count() > 0:
                first = loc.first
                if first.is_visible():
                    first.click(timeout=2000)
                    time.sleep(0.6)
                    return
        except Exception:
            continue

    # 전략 2: '운영 중' 또는 '영업시간' 텍스트가 있는 행 자체를 클릭
    for text in ("운영 중", "영업시간", "영업 종료"):
        try:
            row = page.get_by_text(text, exact=False).first
            if row.is_visible():
                row.click(timeout=2000)
                time.sleep(0.6)
                return
        except Exception:
            continue

    # 전략 3: 텍스트 레이블이 있는 버튼 (기존 코드 유지)
    for label in ("펼치기", "더보기", "상세보기", "영업시간 더보기"):
        try:
            btn = page.get_by_role("button", name=re.compile(label))
            if btn.count() > 0 and btn.first.is_visible():
                btn.first.click(timeout=2000)
                time.sleep(0.4)
                return
        except Exception:
            continue


def _extract_hours_from_page_sync(page: Any) -> str:
    """Playwright Page에서 영업시간 텍스트 추출."""
    try:
        page.wait_for_selector("text=영업시간", timeout=8000)
    except Exception:
        return ""

    # 꺽새 클릭으로 요일별 상세 시간 펼치기
    _try_expand_hours(page)

    # 펼쳐진 뒤 추가 렌더링 대기
    time.sleep(0.5)

    # 예제 코드와 동일한 셀렉터 우선 (.gPAvO)
    for sel in (".gPAvO", "._rvS6"):
        try:
            loc = page.locator(sel)
            if loc.count() > 0:
                parts = loc.all_text_contents()
                merged = " | ".join(
                    p.replace("\n", " ").strip() for p in parts if p and p.strip()
                )
                if merged.strip():
                    return _normalize_hours_text(merged)
        except Exception:
            continue

    # fallback: aria-expanded='true' 이후 나타나는 컨텐츠 텍스트
    try:
        expanded = page.locator("[aria-expanded='true']")
        if expanded.count() > 0:
            t = expanded.first.inner_text(timeout=3000)
            if t and ("영업" in t or ":" in t):
                return _normalize_hours_text(t)
    except Exception:
        pass

    # 최후 fallback: '영업시간' 주변 부모 섹션 텍스트 전체
    try:
        h = page.get_by_text("영업시간", exact=False).first
        section = h.locator(
            "xpath=ancestor::*[self::div or self::section or self::li]"
            "[contains(@class,'place') or contains(@class,'Place') "
            "or contains(@class,'detail') or contains(@class,'section')][1]"
        )
        if section.count():
            t = section.first.inner_text(timeout=3000)
            if t and "영업" in t:
                return _normalize_hours_text(t)
    except Exception:
        pass

    return ""


def crawl_naver_place_hours_batch(place_names: list[str]) -> dict[str, str]:
    """장소명 목록에 대해 Playwright만으로 영업시간 순차 수집. API 키 불필요.

    Returns:
        place_name -> 영업시간 문자열 (실패 시 해당 키 없음)
    """
    if not place_names:
        return {}

    try:
        from playwright.sync_api import sync_playwright  # type: ignore[import-untyped]
    except ImportError:
        logger.warning("playwright 패키지 없음 – 영업시간 수집 생략")
        return {}

    timeout = max(5000, int(settings.naver_place_hours_page_timeout_ms))
    out: dict[str, str] = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            context = browser.new_context(
                user_agent=_DEFAULT_UA,
                locale="ko-KR",
                viewport={"width": 1280, "height": 900},
            )
            for name in place_names:
                # 1단계: 검색 페이지에서 place_id 추출
                search_page = context.new_page()
                place_id: str | None = None
                try:
                    place_id = _search_place_id_sync(search_page, name, timeout)
                except Exception as e:
                    logger.debug("place_id 추출 실패 (%s): %s", name, e)
                finally:
                    search_page.close()

                if not place_id:
                    logger.debug("place_id 없음 – 영업시간 생략: %s", name)
                    continue

                # 2단계: place 상세 페이지에서 영업시간 추출 (예제 코드 패턴)
                detail_page = context.new_page()
                try:
                    detail_url = f"https://pcmap.place.naver.com/place/{place_id}/home"
                    detail_page.goto(
                        detail_url, wait_until="domcontentloaded", timeout=timeout
                    )
                    # 네이버 SPA 렌더링 대기
                    try:
                        detail_page.wait_for_load_state("networkidle", timeout=8000)
                    except Exception:
                        time.sleep(1.5)

                    text = _extract_hours_from_page_sync(detail_page)
                    if text:
                        out[name] = text
                        logger.debug("영업시간 확보: %s → %s", name, text[:60])
                except Exception as e:
                    logger.debug("상세 페이지 크롤 실패 place_id=%s (%s): %s", place_id, name, e)
                finally:
                    detail_page.close()
        finally:
            browser.close()

    return out


async def enrich_schedule_items_with_hours(
    schedule: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """일정 항목에 business_hours를 보강한다. API 키 불필요.

    NAVER_PLACE_HOURS_ENABLED=true 일 때만 동작.
    이미 business_hours 가 있는 항목은 스킵.
    """
    if not settings.naver_place_hours_enabled or not schedule:
        return schedule

    # 보강이 필요한 항목의 장소명 수집 (중복 제거)
    name_to_items: dict[str, list[int]] = {}
    for idx, item in enumerate(schedule):
        if item.get("business_hours"):
            continue
        q = (item.get("place") or item.get("title") or "").strip()
        if q:
            name_to_items.setdefault(q, []).append(idx)

    unique_names = list(name_to_items.keys())
    if not unique_names:
        return [dict(it) for it in schedule]

    # 스레드에서 동기 Playwright 실행
    hours_map: dict[str, str] = await asyncio.to_thread(
        crawl_naver_place_hours_batch, unique_names
    )

    enriched = [dict(it) for it in schedule]
    for name, idxs in name_to_items.items():
        h = hours_map.get(name)
        if h:
            for i in idxs:
                enriched[i]["business_hours"] = h

    logger.info(
        "영업시간 보강 완료: 총 %d항목, 대상 %d개 장소, 확보 %d개",
        len(schedule),
        len(unique_names),
        sum(1 for n in unique_names if hours_map.get(n)),
    )
    return enriched
