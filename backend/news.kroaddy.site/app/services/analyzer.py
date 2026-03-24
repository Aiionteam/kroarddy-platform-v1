"""GPT-5-mini 기반 K-콘텐츠 뉴스 분류 + 요약 재작성 + Top10 선정."""
import asyncio
import json
import logging
from typing import Optional

from openai import AsyncOpenAI

from app.core.config import settings
from app.services import database as db

logger = logging.getLogger(__name__)

CATEGORIES = ("공연/콘서트", "드라마/영화", "K-pop/아이돌", "축제/전시", "장소/핫플", "기타")

# 제외할 키워드 (부정적 뉴스)
_NEGATIVE_KEYWORDS = (
    "살인", "사망", "사고", "폭행", "사기", "범죄", "체포", "구속", "기소",
    "논란", "비난", "갈등", "소송", "재판", "마약", "음주", "불법", "의혹",
    "실종", "자살", "부상", "화재", "폭발", "침수", "파산", "해고",
)

# 해외 지명 키워드 → 한국 외 장소에서 열리는 행사 사전 차단
_OVERSEAS_KEYWORDS = (
    # 중국
    "중국", "베이징", "상하이", "난징", "청두", "광저우", "선전", "홍콩",
    # 일본
    "일본", "도쿄", "오사카", "나고야", "후쿠오카", "삿포로",
    # 미국
    "미국", "뉴욕", "로스앤젤레스", "라스베이거스", "시카고",
    # 영어 표기
    "China", "Beijing", "Shanghai", "Japan", "Tokyo", "USA", "New York",
    # 기타
    "유럽", "영국", "프랑스", "독일", "태국", "싱가포르", "대만",
)


def _is_overseas(title: str, summary: str) -> bool:
    """제목/요약에 해외 지명이 포함된 행사면 True."""
    text = title + " " + summary
    return any(kw in text for kw in _OVERSEAS_KEYWORDS)


def _client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.openai_api_key)


def _is_negative(title: str, summary: str) -> bool:
    """제목/요약에 부정적 키워드가 있으면 True."""
    text = title + summary
    return any(kw in text for kw in _NEGATIVE_KEYWORDS)


# ─── 배치 분류 + 요약 재작성 ───────────────────────────────────────

_CLASSIFY_SYSTEM = """당신은 대한민국 K-콘텐츠 여행 앱의 뉴스 큐레이터입니다.
외국인과 국내 여행자에게 **한국 내** 문화/연예/공연 정보를 소개하는 역할입니다.

반드시 아래 규칙을 따르세요:
1. 범죄, 사고, 논란, 정치, 사회 문제 등 부정적 뉴스는 relevance_score를 1로 설정
2. 한국(대한민국) 내에서 열리는 공연, 콘서트, 팬미팅, 드라마, K-pop, 축제, 전시, 핫플레이스 정보는 높은 점수
3. **해외(중국, 일본, 미국, 유럽 등 한국 외 국가)에서 열리는 행사·공연·투어는 relevance_score를 2 이하로 설정**
   - 예: "중국 상하이 공연", "일본 도쿄 팬미팅", "미국 투어" → 점수 1~2
   - 한국 아티스트 해외 활동 소식이더라도 장소가 해외이면 낮은 점수
4. gpt_summary는 여행자 시각으로 짧고 긍정적으로 재작성 (2~3문장, 한국어)
   - "~에서 열립니다", "~를 만나볼 수 있습니다" 같은 친절한 안내 문체
   - 부정적 내용, 논란, 사건은 절대 포함하지 않음

응답은 반드시 JSON만 출력하세요."""

_CLASSIFY_USER = """다음 {n}개 기사를 분석하세요:

{articles}

각 기사에 대해 아래 JSON 형식으로만 응답하세요:
{{
  "results": [
    {{
      "idx": 0,
      "category": "K-pop/아이돌",
      "location": "서울 광화문",
      "date_mentioned": "2026-03-21",
      "relevance_score": 9,
      "gpt_summary": "BTS가 광화문 광장에서 특별 공연을 펼칩니다. 3월 21일 오후 7시부터 무료로 관람할 수 있습니다."
    }}
  ]
}}

규칙:
- category: 공연/콘서트 | 드라마/영화 | K-pop/아이돌 | 축제/전시 | 장소/핫플 | 기타
- location: 구체적 지역명 (없으면 "전국"). 한국 내 지역만 명시 (예: "서울 홍대", "부산 해운대")
- date_mentioned: 기사에 명시된 날짜 ISO 형식 (없으면 null)
- relevance_score: 여행자 유용성 1~10
  · 부정적 뉴스 = 1
  · 해외(한국 외 국가)에서 열리는 행사·공연 = 1~2 (반드시 낮게!)
  · 날짜+장소 명확한 한국 내 이벤트 = 9~10
- gpt_summary: GPT가 여행자용으로 재작성한 2~3문장 요약 (부정적 뉴스 또는 해외 행사는 "해당 없음")"""


async def classify_batch(articles: list[dict]) -> list[dict]:
    """기사 배치를 GPT로 분류 + 요약 재작성."""
    if not articles or not settings.openai_api_key:
        return []

    # 부정적 뉴스 + 해외 행사 사전 필터링
    filtered = []
    skipped_ids = []
    for i, a in enumerate(articles):
        title = a.get("title", "")
        summary = a.get("summary", "")
        if _is_negative(title, summary) or _is_overseas(title, summary):
            skipped_ids.append(i)
        else:
            filtered.append((i, a))

    if not filtered:
        return []

    article_texts = []
    idx_map = {}  # GPT idx → original idx
    for gpt_idx, (orig_idx, a) in enumerate(filtered):
        idx_map[gpt_idx] = orig_idx
        article_texts.append(
            f"[{gpt_idx}] 제목: {a['title']}\n요약: {a.get('summary', '')[:200]}"
        )

    prompt = _CLASSIFY_USER.format(n=len(filtered), articles="\n\n".join(article_texts))

    try:
        client = _client()
        resp = await client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "system", "content": _CLASSIFY_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)
        results = data.get("results", [])

        # GPT idx → original idx 매핑 복원
        for r in results:
            r["idx"] = idx_map.get(r["idx"], r["idx"])

        # 사전 필터링된 부정 기사는 relevance_score=1로 추가
        for orig_idx in skipped_ids:
            results.append({
                "idx": orig_idx,
                "category": "기타",
                "location": "전국",
                "date_mentioned": None,
                "relevance_score": 1,
                "gpt_summary": "",
            })

        return results
    except Exception as e:
        logger.error("GPT 분류 실패: %s", e)
        return []


# ─── Top10 선정 ────────────────────────────────────────────────

_TOP10_SYSTEM = """당신은 대한민국 K-콘텐츠 여행 앱 큐레이터입니다.
여행자에게 가장 유용하고 긍정적인 K-문화 뉴스 Top10을 선정합니다."""

_TOP10_USER = """다음 기사 목록에서 여행자에게 가장 유용한 Top10을 선정하세요.

선정 기준 (우선순위 순):
1. 날짜와 장소가 명확한 공연/콘서트/팬미팅/축제/전시
2. K-pop 아이돌, 드라마, 영화 관련 긍정 소식
3. 핫플레이스, 드라마 촬영지, 팝업스토어
4. 지역 문화 행사

반드시 제외:
- 범죄, 사고, 논란, 부정적 뉴스
- relevance_score 3 이하 기사

기사 목록:
{articles}

아래 JSON 형식으로만 응답하세요:
{{
  "top10": ["link1", "link2", ...]
}}

정확히 최대 10개, link 문자열 배열로 응답하세요."""


async def select_top10(recent_articles: list[dict]) -> list[str]:
    """최근 기사에서 Top10 link 목록 선정 (부정 뉴스 제외)."""
    if not recent_articles or not settings.openai_api_key:
        return []

    # relevance_score 4 이상만 후보
    candidates = [a for a in recent_articles if a.get("relevance_score", 5) >= 4]
    candidates = sorted(candidates, key=lambda x: x.get("relevance_score", 5), reverse=True)[:60]

    if not candidates:
        return []

    lines = []
    for a in candidates:
        loc = a.get("location", "전국")
        cat = a.get("category", "기타")
        dt = a.get("date_mentioned") or ""
        score = a.get("relevance_score", 5)
        lines.append(f"- [{cat}] {a['title']} | 장소:{loc} | 날짜:{dt} | 점수:{score} | link:{a['link']}")

    try:
        client = _client()
        resp = await client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "system", "content": _TOP10_SYSTEM},
                {"role": "user", "content": _TOP10_USER.format(articles="\n".join(lines))},
            ],
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)
        return data.get("top10", [])[:10]
    except Exception as e:
        logger.error("GPT Top10 선정 실패: %s", e)
        return []


# ─── 전체 파이프라인 ───────────────────────────────────────────

async def run_pipeline() -> None:
    """신규 기사 분류 → Top10 재선정 → DB 저장."""
    loop = asyncio.get_event_loop()

    unanalyzed = await loop.run_in_executor(None, lambda: db.get_unanalyzed(50))
    if unanalyzed:
        logger.info("GPT 분류 시작: %d건", len(unanalyzed))
        results = await classify_batch(unanalyzed)

        result_map = {r["idx"]: r for r in results}
        for i, article in enumerate(unanalyzed):
            r = result_map.get(i, {})
            await loop.run_in_executor(None, lambda a=article, rv=r: db.save_analysis(
                a["id"],
                rv.get("category", "기타"),
                rv.get("location", "전국"),
                rv.get("date_mentioned"),
                rv.get("relevance_score", 5),
                rv.get("gpt_summary", ""),
            ))
        logger.info("GPT 분류 완료: %d건", len(results))

    recent = await loop.run_in_executor(None, lambda: db.get_recent(48, 200))
    if recent:
        top10_links = await select_top10(recent)
        if top10_links:
            await loop.run_in_executor(None, db.reset_top10)
            for rank, link in enumerate(top10_links, 1):
                await loop.run_in_executor(None, lambda l=link, r=rank: db.set_top10(l, r))
            logger.info("Top10 갱신 완료: %s", top10_links[:3])

    deleted = await loop.run_in_executor(None, db.cleanup_expired)
    if deleted:
        logger.info("만료 기사 삭제: %d건", deleted)
