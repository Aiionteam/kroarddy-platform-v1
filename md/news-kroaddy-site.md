# news.kroaddy.site — 뉴스 RSS·GPT 분석 서비스

## 역할

한국 뉴스 **RSS 수집**, **PostgreSQL 저장**, **OpenAI(GPT) 기반 분류·파이프라인**을 제공하는 **독립 FastAPI** 서비스입니다. 트래픽 진입은 보통 **api.kroaddy.site 게이트웨이**를 통해 `/api/v1/news/**` 로 프록시됩니다.

## 기술 스택

| 구분 | 선택 |
|------|------|
| 언어 | Python 3.11 |
| 웹 | FastAPI, Uvicorn |
| HTTP / 피드 | httpx, feedparser |
| AI | OpenAI Python SDK (`openai`) |
| DB | PostgreSQL (`psycopg2-binary`), Raw SQL 유사 레이어 (`app/services/database.py`) |
| 설정 | pydantic-settings, python-dotenv (`.env`) |

## 런타임·포트

- 기본 포트 **8005** (`PORT` 환경변수로 변경 가능).
- `Dockerfile`: `uvicorn app.main:app --host 0.0.0.0 --port 8005 --workers 1`.

## 내부 구조

```
app/
  main.py          # FastAPI 앱, lifespan: DB 초기화, 스케줄러, RSS 워밍업
  api/v1/routes.py # /api/v1/news ... REST
  services/
    crawler.py     # RSS, OG 이미지, 카테고리별 수집
    database.py    # upsert, 조회 등
    analyzer.py    # GPT 파이프라인
  core/config.py   # OPENAI_API_KEY, DATABASE_URL 등
```

### 동작 요약

- **수집 주기**: 약 **6시간**마다 백그라운드에서 RSS 수집 → DB 반영 → 신규 기사가 있으면 GPT 파이프라인 실행.
- **시작 시**: DB 초기화, 즉시 1회 수집, 썸네일 소급 보강 태스크, RSS 인메모리 캐시 워밍.
- **API 예시**: `/api/v1/news/processed`(가공 뉴스), `/api/v1/news`(캐시 목록), `/api/v1/news/categories` 등.

## 외부 연동

- **OpenAI API**: 분석·분류 (모델은 코드/설정에 따름).
- **PostgreSQL**: `database_url` (`Settings` in `app/core/config.py`).
- **RSS 소스**: `crawler`에 정의된 피드 URL.

## 다른 서버와의 연결

| 방향 | 설명 |
|------|------|
| **인바운드** | **api.kroaddy.site** 게이트웨이가 `Path=/api/v1/news,/api/v1/news/**` 를 `http://news:8005`(또는 `AI_SERVICE_NEWS_URL`)로 역프록시. |
| **아웃바운드** | RSS·OpenAI·DB로의 아웃바운드만; 게이트웨이나 플래너를 **호출하지 않는** 구조가 기본입니다. |

프론트는 직접 `news.kroaddy.site`에 붙지 않고, **통합 API 도메인 경유**가 설정상 자연스럽습니다.

## 배포

- **Docker**: 루트 `Dockerfile` — slim 이미지, `requirements.txt` 설치 후 `app`만 복사.
- **CI**: `.github/workflows/deploy-news.yml` — Docker Hub `news.kroaddy.site` 이미지 빌드·푸시.

## 관련 레포지토리 경로

`backend/news.kroaddy.site/`
