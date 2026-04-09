Kroaddy 프로젝트 기술서

1. 개요

Kroaddy는 여행 계획, 콘텐츠, 소셜 기능을 하나로 묶은 마이크로서비스 기반 웹·앱 플랫폼으로 설계했습니다. 브라우저와 모바일 앱은 단일 API 진입점인 https://api.kroaddy.site를 기준으로 요청을 보내고, Spring Boot 게이트웨이가 경로에 따라 Python FastAPI 계열 서비스로 요청을 분산하도록 구성했습니다.

전체적으로는 Spring Boot 3 기반 게이트웨이와 FastAPI 기반 AI 플래너, PostgreSQL·Redis, Docker·EC2 운영, Next.js 16·React 19 웹, Flutter 모바일을 하나의 서비스 흐름으로 연결하는 구조로 설계했습니다.

2. 시스템 구성

클라이언트는 https://web.kroaddy.site 및 보조 웹 www.kroaddy.site, 그리고 Flutter 앱으로 나누어 운영했습니다. 웹은 Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand, i18next를 중심으로 구성했고, 모바일은 Flutter, Riverpod, go_router, Dio를 사용해 동일한 백엔드와 통신하도록 맞췄습니다.

서버 쪽의 중심은 backend/api.kroaddy.site에 있는 Java 21, Spring Boot 3.5 계열 게이트웨이로 두었습니다. 이 애플리케이션 안에는 인증, JWT, 유저, 그룹채팅, JPA 기반 도메인 API를 함께 넣었고, 동시에 Spring Cloud Gateway WebMVC를 사용해 경로별 프록시 역할도 담당하게 했습니다. 실제 AI·도메인 기능은 FastAPI 마이크로서비스로 분리하여 개발했고, 운영 환경에서는 Docker Compose 안에서 서비스명 기반 내부 URL로 통신하도록 구성했습니다.

3. 게이트웨이 기준 서비스 구성

외부 클라이언트 입장에서는 포트를 직접 알 필요 없이 https://api.kroaddy.site 아래 경로만 보면 되도록 정리했습니다. 내부적으로는 docker-compose.yaml에서 guide, planer, profile, news, tourstar 같은 서비스를 분리하여 운영했고, 게이트웨이는 AI_SERVICE 계열 환경변수로 각 서비스 주소를 받아 연결하도록 구성했습니다.

서비스별 역할은 다음과 같이 정리했습니다.

- gateway: https://api.kroaddy.site 전반에서 OAuth, JWT, 유저, 그룹채팅 등 코어 MVC API와 BFF 역할을 담당했습니다.
- guide: https://api.kroaddy.site/guide, https://api.kroaddy.site/api/v1/festivals 등으로 노출되며 장소·행사 중심의 가이드 데이터를 제공했습니다.
- planer: https://api.kroaddy.site/api/v1/planner, user-content, k-content, weather, maps 계열 경로를 처리하며 AI 일정 생성, 지도, 날씨 연동을 담당했습니다.
- profile: https://api.kroaddy.site/api/v1/user-profile 경로를 기준으로 개인화 프로필 기능을 담당했습니다.
- news: https://api.kroaddy.site/api/v1/news 경로에서 RSS·뉴스 관련 기능을 처리했습니다.
- tourstar: 정적 파일 경로와 전용 API 경로를 통해 사진 선별, 게시글 생성, 비전·에이전트 파이프라인을 담당했습니다.

공용 Docker 네트워크는 kroaddy-net 브리지였고, 실제 라우팅 세부 사항은 md/api-kroaddy-site.md와 application.yaml을 기준으로 정리했습니다.

4. 요청 흐름 요약

아래 도식은 고정폭 글꼴에서 가장 잘 보였습니다. Word에 붙여 넣을 때는 Courier New, Consolas, 맑은 고정폭 같은 글꼴로 지정하는 편이 자연스러웠습니다.

```
+---------------+       +---------------+
| web / www     |       | Flutter app   |
| Next.js       |       |               |
+-------+-------+       +-------+-------+
        |                       |
        +-----------+-----------+
                    |
                    v
        +---------------------------+
        | https://api.kroaddy.site  |
        +---------------------------+
        | Spring MVC  | Gateway MVC |
        +-------+-----+------+------+
                |            |
                |            +-------------------> guide
                |            +-------------------> planer
                |            +-------------------> profile
                |            +-------------------> news
                |            +-------------------> tourstar
                v
        +---------------------------+
        | PostgreSQL  |  Redis      |
        +---------------------------+
```

위 흐름에서 web/www와 Flutter는 사용자 클라이언트였고, Gateway MVC는 요청 경로에 따라 뒤쪽 FastAPI 서비스로 넘기는 역할을 맡았습니다. Spring MVC는 OAuth, 유저, JPA 기반 도메인 처리와 함께 DB, Redis를 직접 사용했습니다.

5. 기술 스택

웹 프론트는 Node.js 20 이상, pnpm 10, Next.js 16.1.6, React 19.2, TypeScript 5, Tailwind CSS 4, PostCSS, Zustand, i18next, react-i18next, exifr를 중심으로 구성했습니다.

API 게이트웨이는 Java 21, Spring Boot 3.5.8, Spring Cloud 2025.0.0의 spring-cloud-starter-gateway-server-webmvc, Spring Security, OAuth2 Client, JWT, Spring Data JPA, Hibernate, PostgreSQL, QueryDSL, Spring Data Redis, Apache HttpClient 5, SpringDoc OpenAPI를 사용했습니다. 빌드와 배포는 멀티스테이지 Dockerfile과 GitHub Actions, Docker Hub를 기준으로 운영했습니다.

Tour Planner는 FastAPI, Uvicorn, LangGraph, LangChain Google GenAI, LangChain OpenAI, SQLAlchemy async, asyncpg, psycopg2, Alembic, boto3, httpx, Playwright, Pillow, NudeNet, ONNX Runtime, pydantic-settings, python-multipart를 사용했습니다. standard, k_content, user_content, weather, maps 등 라우터를 v1 아래로 묶어 관리했고, LangGraph와 LLM으로 여행 루트와 일정을 생성하도록 개발했습니다.

Profile 서비스는 FastAPI, Uvicorn, SQLAlchemy async, asyncpg, Alembic, Pydantic으로 개인화 프로필을 담당했습니다.

News 서비스는 FastAPI, Uvicorn, feedparser, OpenAI, psycopg2를 기반으로 RSS·뉴스 파이프라인을 구성했습니다.

Tourstar 서비스는 FastAPI, LangGraph, NumPy, OpenCV headless, Ultralytics, pyIQA, Pillow, SQLAlchemy, asyncpg, Alembic, boto3를 사용하여 사진 품질 판별과 선별, 에이전트 워크플로를 담당했습니다.

모바일은 Flutter, flutter_riverpod, go_router, dio, flutter_secure_storage, image_picker, exif, share_plus, url_launcher, app_links를 사용했습니다.

6. MSA 아키텍처

클라이언트는 항상 https://api.kroaddy.site라는 한 호스트만 바라보도록 설계했습니다. Spring Cloud Gateway WebMVC가 /api/v1/news, /api/v1/planner, /api/v1/user-profile, /guide, Tourstar 전용 경로 등을 내부 FastAPI 컨테이너로 넘기고, 동일한 Spring Boot 프로세스 안에서는 OAuth2, JWT, 유저, 친구, 그룹채팅, 다이어리 같은 JPA 기반 도메인 API가 함께 동작하도록 구성했습니다.

이 구조의 핵심은 한 JVM 안에 BFF, 인증, 코어 도메인 기능을 두면서도, AI와 부가 기능은 독립적인 서비스로 분리했다는 점이었습니다. 로컬과 서버 모두 Docker Compose 기준으로 서비스를 묶고, kroaddy-net 브리지에서 이름 기반으로 호출했습니다.

7. LangGraph 및 AI 파이프라인

플래너 서비스는 LangGraph를 중심으로 워크플로를 나누어 구성했습니다. 코드베이스에는 standard와 k_content처럼 그래프·노드 패키지를 분리하여 관리했고, LangChain Google GenAI와 OpenAI 계열을 이용해 LLM 호출 흐름을 연결했습니다. 사용자 업로드·콘텐츠 기반 흐름은 user_content API와 맞물려 동작하게 했고, 날씨와 지도, 예를 들면 네이버 지도 API 같은 외부 데이터 연동도 같은 서비스 안에서 처리하도록 설계했습니다.

Tourstar는 별도 FastAPI 앱 안에서 LangGraph와 비전 스택을 결합해 사진 선별·후처리 파이프라인을 구성했습니다. 플래너 쪽 업로드 이미지 처리 과정에는 NudeNet과 ONNX를 이용한 NSFW 검사 흐름도 포함해 운영했습니다.

8. AWS 인프라 및 배포

객체 스토리지는 AWS S3를 사용했습니다. 플래너와 Tourstar 등에서는 boto3로 버킷에 파일을 올리고, 필요할 때는 presigned URL 방식으로 클라이언트와 직접 통신하도록 설계했습니다. 데이터베이스는 PostgreSQL, 세션과 토큰 계층은 Redis를 사용했고, 운영 환경에서는 Upstash Redis URL 형태로 주입하는 설정을 게이트웨이에 반영했습니다.

배포는 CI에서 Docker 이미지를 빌드한 뒤 Docker Hub에 푸시하고, EC2 같은 호스트에서 docker pull과 docker run 또는 Compose로 구동하는 방식으로 정리했습니다. 관련 워크플로는 deploy-api-gateway.yml, deploy-planer.yml, deploy-profile.yml, deploy-news.yml, deploy-tourstar.yml 등으로 분리하여 관리했고, 일부 서비스는 Watchtower 기반 자동 갱신 방식까지 고려했습니다. 프론트는 Vercel 배포 가이드를 기준으로 게이트웨이 URL을 환경변수로 연결해 web.kroaddy.site에서 API를 호출하도록 구성했습니다.

9. 로컬 개발 및 설정

로컬이나 스테이징에서는 저장소 루트에서 docker compose up -d --build 명령으로 게이트웨이와 Python 서비스를 한 번에 띄우도록 구성했습니다. 게이트웨이만 필요할 때는 backend/api.kroaddy.site/docker-compose.yml을 별도로 사용하도록 정리했습니다.

서비스별 .env와 게이트웨이의 SPRING 계열, AI_SERVICE 계열 URL, OAuth 리다이렉트, JWT, DB, Redis, 날씨 API 키 등은 모두 환경변수로 주입했습니다. CORS에는 https://web.kroaddy.site, http://localhost:3000 등을 허용 출처로 설정했고, AI 응답 지연을 고려해 게이트웨이의 HTTP 읽기 타임아웃도 길게 잡았습니다. API 문서는 SpringDoc과 FastAPI 메타·헬스 엔드포인트로 확인하도록 구성했습니다.

결과적으로 Next.js 웹과 Flutter 앱이 같은 API 도메인을 공유하는 크로스 플랫폼 구조를 유지하면서도, 서비스별 책임은 비교적 명확하게 분리하여 관리했습니다.

10. 참고 경로

게이트웨이 라우트와 패키지 구조는 md/api-kroaddy-site.md, 플래너 상세는 md/planer-kroaddy-site.md를 기준으로 참고하면 됩니다. 전체 의존성과 내부 URL은 루트 docker-compose.yaml을 기준으로 정리했고, 핵심 디렉터리는 backend/api.kroaddy.site/gateway, backend/planer.kroaddy.site, front/web.kroaddy.site로 잡았습니다.

Flutter 모바일 앱(`front/flutter`)의 전체 아키텍처·라우팅·기능별 API 매핑은 md/flutter-kroaddy-app.md 및 md/flutter-kroaddy-*.md 시리즈를 참고하면 됩니다.

11. 전체 아키텍처

아래 도식 역시 고정폭 글꼴에서 보았을 때 가장 안정적으로 정렬되었습니다.

```
                        +------------------+
                        | web.kroaddy.site |
                        +------------------+
                        | www.kroaddy.site |
                        +------------------+
                        | Flutter app      |
                        +--------+---------+
                                 |
                                 v
+----------------------------------------------------------------+
|                    https://api.kroaddy.site                    |
+----------------------------------------------------------------+
| Spring MVC: OAuth2, JWT, user, chat, JPA domains               |
+----------------------------------------------------------------+
| Gateway MVC: path-based reverse proxy to internal services     |
+----------------------------------------------------------------+
                                 |
     v           v           v           v           v
+-----------+ +-----------+ +-----------+ +-----------+ +-----------+
|   guide   | |  planer   | |  profile  | |   news    | | tourstar  |
|  FastAPI  | |  FastAPI  | |  FastAPI  | |  FastAPI  | |  FastAPI  |
|           | | LangGraph | |           | |           | | CV, agent |
+-----+-----+ +-----+-----+ +-----+-----+ +-----+-----+ +-----+-----+
      |             |             |             |             |
      +-------------+-------------+-------------+-------------+
                                    |
                                    v
                        +-----------------------------------+
                        | PostgreSQL        Redis           |
                        | per-service / gateway schemas     |
                        +-----------------------------------+
```

추가 데이터 흐름은 다음과 같이 정리했습니다.

planer는 내부 HTTP로 guide와 profile을 호출하도록 구성했고, 외부로는 AWS S3, Gemini·OpenAI 계열 LLM, 지도 API, 날씨 API를 연동했습니다. tourstar 역시 필요에 따라 AWS S3와 LLM 계층을 함께 사용하도록 설계했습니다.

이 문서는 레포의 package.json, build.gradle, requirements.txt, docker-compose.yaml, 워크플로 및 내부 문서를 근거로 정리했습니다.
