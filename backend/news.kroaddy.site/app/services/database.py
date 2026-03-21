"""Neon PostgreSQL 기반 뉴스 기사 저장소."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import psycopg2
import psycopg2.extras

from app.core.config import settings

logger = logging.getLogger(__name__)
ARTICLE_TTL_HOURS = 48


def _conn():
    return psycopg2.connect(settings.get_db_url(), cursor_factory=psycopg2.extras.RealDictCursor)


def init_db() -> None:
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS news_articles (
                    id              SERIAL PRIMARY KEY,
                    link            TEXT    UNIQUE NOT NULL,
                    title           TEXT    NOT NULL,
                    summary         TEXT    DEFAULT '',
                    gpt_summary     TEXT    DEFAULT '',
                    source          TEXT    DEFAULT '',
                    published       TEXT    DEFAULT '',
                    thumbnail       TEXT,
                    raw_category    TEXT    DEFAULT 'all',
                    category        TEXT    DEFAULT '기타',
                    location        TEXT    DEFAULT '전국',
                    date_mentioned  TEXT,
                    relevance_score INTEGER DEFAULT 5,
                    is_top10        BOOLEAN DEFAULT FALSE,
                    top10_rank      INTEGER,
                    analyzed        BOOLEAN DEFAULT FALSE,
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    expires_at      TIMESTAMPTZ NOT NULL
                )
            """)
            # 기존 테이블에 gpt_summary 컬럼 추가 (이미 있으면 무시)
            cur.execute("""
                ALTER TABLE news_articles
                ADD COLUMN IF NOT EXISTS gpt_summary TEXT DEFAULT ''
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_na_analyzed  ON news_articles(analyzed)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_na_is_top10  ON news_articles(is_top10)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_na_expires   ON news_articles(expires_at)")
        c.commit()
    logger.info("news_articles 테이블 준비 완료")


def upsert_articles(items: list[dict], raw_category: str = "all") -> int:
    expires = datetime.now(timezone.utc) + timedelta(hours=ARTICLE_TTL_HOURS)
    inserted = 0
    with _conn() as c:
        with c.cursor() as cur:
            for item in items:
                cur.execute(
                    """INSERT INTO news_articles
                       (link, title, summary, source, published, thumbnail, raw_category, expires_at)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                       ON CONFLICT (link) DO UPDATE
                         SET thumbnail = COALESCE(EXCLUDED.thumbnail, news_articles.thumbnail)
                       RETURNING (xmax = 0) AS is_insert""",
                    (
                        item["link"], item["title"], item.get("summary", ""),
                        item.get("source", ""), item.get("published", ""),
                        item.get("thumbnail"), raw_category, expires,
                    ),
                )
                row = cur.fetchone()
                if row and row["is_insert"]:
                    inserted += 1
        c.commit()
    return inserted


def get_unanalyzed(limit: int = 50) -> list[dict]:
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(
                "SELECT * FROM news_articles WHERE analyzed=FALSE ORDER BY created_at DESC LIMIT %s",
                (limit,),
            )
            return [dict(r) for r in cur.fetchall()]


def get_recent(hours: int = 48, limit: int = 200) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(
                """SELECT * FROM news_articles
                   WHERE created_at >= %s AND analyzed=TRUE
                   ORDER BY relevance_score DESC, published DESC LIMIT %s""",
                (since, limit),
            )
            return [dict(r) for r in cur.fetchall()]


def save_analysis(article_id: int, category: str, location: str,
                  date_mentioned: Optional[str], relevance_score: int,
                  gpt_summary: str = "") -> None:
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(
                """UPDATE news_articles
                   SET category=%s, location=%s, date_mentioned=%s,
                       relevance_score=%s, gpt_summary=%s, analyzed=TRUE
                   WHERE id=%s""",
                (category, location, date_mentioned, relevance_score, gpt_summary, article_id),
            )
        c.commit()


def reset_top10() -> None:
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE news_articles SET is_top10=FALSE, top10_rank=NULL")
        c.commit()


def set_top10(link: str, rank: int) -> None:
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(
                "UPDATE news_articles SET is_top10=TRUE, top10_rank=%s WHERE link=%s",
                (rank, link),
            )
        c.commit()


def get_processed_news(limit_rest: int = 50) -> dict:
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(
                "SELECT * FROM news_articles WHERE is_top10=TRUE ORDER BY top10_rank ASC"
            )
            top10 = [dict(r) for r in cur.fetchall()]

            cur.execute(
                """SELECT * FROM news_articles
                   WHERE is_top10=FALSE AND analyzed=TRUE
                   ORDER BY published DESC LIMIT %s""",
                (limit_rest,),
            )
            rest = [dict(r) for r in cur.fetchall()]

    return {"top10": top10, "rest": rest}


def get_thumbnailless(limit: int = 100) -> list[dict]:
    """썸네일이 없는 기사 목록 반환."""
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(
                """SELECT id, link FROM news_articles
                   WHERE thumbnail IS NULL OR thumbnail = ''
                   ORDER BY created_at DESC LIMIT %s""",
                (limit,),
            )
            return [dict(r) for r in cur.fetchall()]


def update_thumbnail(article_id: int, thumbnail: str) -> None:
    """기사 썸네일 업데이트."""
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(
                "UPDATE news_articles SET thumbnail=%s WHERE id=%s",
                (thumbnail, article_id),
            )
        c.commit()


def cleanup_expired() -> int:
    now = datetime.now(timezone.utc)
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("DELETE FROM news_articles WHERE expires_at < %s", (now,))
            deleted = cur.rowcount
        c.commit()
    return deleted
