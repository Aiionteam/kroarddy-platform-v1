# profile.kroaddy.site — 사용자 여행 프로필(User Info) 서비스

## 역할

첫 로그인 등에서 수집하는 **여행 개인화 프로필**(성별, 나이대, 식습관, 종교, 국적 등)을 **저장·조회·수정**하는 FastAPI 서비스입니다. API 경로는 `/api/v1/user-profile/**` 이며, 진입은 **api.kroaddy.site 게이트웨이**를 통해 `user_info` 호스트(컨테이너명)로 프록시됩니다.

## 기술 스택

| 구분 | 선택 |
|------|------|
| 언어 | Python 3.11 |
| 웹 | FastAPI, Uvicorn |
| ORM | SQLAlchemy 2.x (**async**), asyncpg |
| 마이그레이션 | Alembic (`alembic/`, `alembic.ini`) |
| 검증 | Pydantic v2 |
| DB | PostgreSQL |

## 런타임·포트

- 기본 포트 **8004** (`PORT` 환경변수).
- `Dockerfile`: `uvicorn app.main:app --host 0.0.0.0 --port 8004`.

## 내부 구조

```
app/
  main.py                    # FastAPI, CORS, 라우터 마운트
  api/v1/routes_profile.py   # GET /{user_id}, POST "" (upsert)
  api/v1/schemas_profile.py
  models/user_profile.py
  core/
    config.py                # DATABASE_URL → async/sync URL 변환
    database/session.py      # AsyncSession 의존성
alembic/versions/            # 스키마 버전 (국적, 프로필 이미지 URL 등 이력)
```

- `app/core/config.py`는 서비스 루트의 `.env`를 로드하고, `postgresql://` 를 `postgresql+asyncpg://` / `postgresql+psycopg2://` 로 맞춥니다(호스트·SSL 파라미터 정리 포함).

## API 요약

- `GET /api/v1/user-profile/{user_id}` — 프로필 조회 (없으면 404).
- `POST /api/v1/user-profile` — upsert (부분 필드 업데이트 지원).
- `GET /health` — 헬스체크.

## 다른 서버와의 연결

| 방향 | 설명 |
|------|------|
| **인바운드** | 게이트웨이 `user-info` 라우트: `AI_SERVICE_USER_INFO_URL` → 기본 `http://user_info:8004`, Path `/api/v1/user-profile/**`. |
| **아웃바운드** | **PostgreSQL**만 (애플리케이션 로직상 외부 HTTP API 의존 없음). |

**planer.kroaddy.site** 는 플래너 추천 시 사용자 맞춤을 위해 `user_info_service_url` 로 이 서비스의 프로필을 **HTTP로 조회**할 수 있습니다(플래너 설정의 기본값은 localhost/Docker 호스트명).

## 배포

- **Docker**: 소스 전체 복사(`COPY . .`), Alembic은 이미지에 포함되나 **시작 CMD는 alembic 없이 uvicorn만** — 마이그레이션은 배포 파이프라인 또는 수동 실행 전제일 수 있음(운영 시 확인 필요).
- **CI**: `.github/workflows/deploy-profile.yml` — Docker Hub `profile.kroaddy.site` 이미지.

## 관련 레포지토리 경로

`backend/profile.kroaddy.site/`
