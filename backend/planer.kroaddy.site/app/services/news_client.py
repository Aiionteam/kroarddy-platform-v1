"""뉴스 서비스 클라이언트 – Top10 뉴스 조회 및 날짜 필터링."""
import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 5.0


async def fetch_news_top10(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> list[dict]:
    """뉴스 서비스에서 Top10 K-콘텐츠 뉴스를 가져온다.

    start_date/end_date가 있으면 date_mentioned가 여행 기간 내인 항목을
    앞에 정렬하고, 나머지는 뒤에 붙인다.
    """
    url = settings.news_service_url.rstrip("/") + "/api/v1/news/processed"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, params={"limit_rest": 0})
            resp.raise_for_status()
            data = resp.json()
        top10: list[dict] = data.get("top10", [])
        if start_date and end_date and top10:
            top10 = _sort_by_date_relevance(top10, start_date, end_date)
        logger.info("뉴스 Top10 조회 완료: %d건 (여행기간=%s~%s)", len(top10), start_date, end_date)
        return top10[:10]
    except Exception as e:
        logger.warning("뉴스 Top10 조회 실패 (무시): %s", e)
        return []


def _sort_by_date_relevance(
    items: list[dict], start_date: str, end_date: str
) -> list[dict]:
    """date_mentioned가 여행 기간 내인 항목을 앞으로 정렬."""
    in_range: list[dict] = []
    out_of_range: list[dict] = []
    for item in items:
        dm = (item.get("date_mentioned") or "").strip()
        if dm and start_date <= dm <= end_date:
            in_range.append(item)
        else:
            out_of_range.append(item)
    return in_range + out_of_range


def build_news_block_for_prompt(
    news_top10: list[dict],
    location_name: str = "",
    *,
    for_k_content: bool = False,
) -> str:
    """뉴스 Top10 → 프롬프트 삽입용 텍스트 블록 생성.

    for_k_content=True이면 날짜가 여행 기간 내인 항목 강조 + 지시어 강화.
    """
    if not news_top10:
        return ""

    lines: list[str] = []
    in_range_count = 0
    for n in news_top10[:10]:
        title = n.get("title", "")
        loc = n.get("location", "")
        date_m = n.get("date_mentioned", "") or ""
        cat = n.get("category", "")
        summary = (n.get("gpt_summary") or n.get("summary", ""))[:80]
        rank = n.get("top10_rank") or ""

        line = f"  • [{cat}] {title}"
        meta: list[str] = []
        if loc and loc != "전국":
            meta.append(loc)
        if date_m:
            meta.append(f"📅{date_m}")
            in_range_count += 1  # 날짜 있는 항목 (sort 후이므로 앞쪽이 기간 내)
        if meta:
            line += f" ({', '.join(meta)})"
        if summary:
            line += f"\n      → {summary}"
        lines.append(line)

    if for_k_content:
        header = "【📰 최신 K-콘텐츠 뉴스 – 날짜가 여행 기간 내인 항목 우선 정렬】"
        footer = (
            "- 위 뉴스에서 공연·이벤트·팝업스토어·핫플이 여행지와 관련 있으면 "
            "일정에 반드시 포함하세요.\n"
            "- 특히 📅가 표시된 항목(여행 기간 내 이벤트)은 해당 날짜에 배치하세요.\n"
        )
    else:
        header = "【📰 최신 K-콘텐츠 뉴스 (루트 추천 참고)】"
        footer = (
            "- 뉴스에 언급된 공연·이벤트·장소가 여행지와 관련 있으면 루트 테마에 반영하세요.\n"
        )

    return header + "\n" + "\n".join(lines) + "\n" + footer + "\n"
