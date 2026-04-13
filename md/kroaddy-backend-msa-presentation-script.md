# Kroaddy 백엔드·MSA 기술 스택 설명 대본

발표·영상·온보딩용 낭독 스크립트. 근거: 루트 `docker-compose.yaml`, `md/api-kroaddy-site.md`, `md/kroaddy-project-technical-spec.md`, 서비스별 `md/*-kroaddy-site.md`, `requirements.txt`, **`backend/api.kroaddy.site/gateway`**(Security·필터·쿠키·Auth·TokenService), **Flutter 앱**(`TokenStore`, `AuthInterceptor`, `jwt_claims` 등) 등.

**예상 길이:** 약 10~14분 (아래 3.3·3.4절 인증·쿠키·Redis·모바일 포함 시)

---

## 1. 오프닝 — 한 줄 정의

안녕하세요. Kroaddy는 여행 계획·콘텐츠·소셜을 묶은 플랫폼인데, 백엔드는 **마이크로서비스**로 나뉘어 있고, 웹·앱은 **하나의 API 주소**만 바라보도록 설계했습니다. 운영에서는 대표적으로 `https://api.kroaddy.site` 한 도메인으로 요청이 들어오고, 그 뒤에서 서비스별 역할이 갈립니다.

---

## 2. 클라이언트 계층

클라이언트는 **Next.js 기반 웹**과 **Flutter 모바일 앱**이고, 둘 다 같은 게이트웨이로 HTTPS 요청을 보냅니다. 사용자는 내부에서 플래너가 8003번, 뉴스가 8005번인지 알 필요가 없습니다. 포트와 서비스 이름은 **Docker 내부 네트워크**에서만 쓰이고, 브라우저·앱이 보는 것은 **통합 API 도메인**뿐입니다.

---

## 3. 핵심 — API 게이트웨이 (`api.kroaddy.site`)

가장 앞단은 **Spring Boot 3.5**, **Java 21**으로 동작하는 게이트웨이입니다. 같은 JVM 안에 두 축이 있습니다.

### 3.1 Spring MVC — 인증·코어 도메인

- **OAuth2** 소셜 로그인, **JWT** 액세스·리프레시 토큰
- **유저·친구·그룹채팅·Whisper** 등 **JPA** 기반 REST API
- 데이터: **PostgreSQL**, 세션·토큰 계층: **Redis** (운영에서는 **Upstash Redis** URL 형태 주입 가능)
- **Spring Security**, 토큰 발급·검증은 **JJWT**
- API 문서: **SpringDoc OpenAPI**

### 3.2 Spring Cloud Gateway WebMVC — 역프록시

- **경로(Path)**만 보고 뒤쪽 **Python FastAPI** 마이크로서비스로 **역프록시**
- AI 응답 지연을 고려해 **HTTP 읽기 타임아웃 180초** 등으로 설정
- **가상 스레드**(`spring.threads.virtual.enabled`)로 동시 처리 효율 확보

자세한 라우트 표는 [`api-kroaddy-site.md`](./api-kroaddy-site.md)를 참고하면 됩니다.

### 3.3 HttpOnly 쿠키, JWT 저장·검증, Redis, 인가 흐름 (`gateway`)

아래는 `backend/api.kroaddy.site/gateway` 소스 기준으로 정리한 **웹 브라우저가 로그인 상태를 유지하는 방식** 설명용 대본입니다. (모바일 앱은 **3.4절**.)

#### (낭독) 한 줄로

웹에서는 가능한 한 **액세스·리프레시 JWT를 JavaScript가 읽을 수 없는 HttpOnly 쿠키**에 넣고, 서버는 요청마다 그걸 꺼내 **JWT 서명 검증 + Redis 로그아웃 마커**를 본 뒤 `SecurityContext`에 사용자를 올려 둡니다. 리프레시 토큰 **원문은 DB에 저장하지 않고 해시만** 저장하며, 갱신할 때마다 **토큰 로테이션(RTR)** 과 **Redis 30초 유예**로 동시 갱신 레이스를 흡수합니다.

#### 쿠키 이름·속성 (`CookieUtil`)

| 쿠키 이름 | 용도 | 대략 TTL | 비고 |
|-----------|------|----------|------|
| `access_token` | API용 JWT 액세스 | **15분** (`max-age` 900초) | `HttpOnly=true`, `Path=/` |
| `refresh_token` | 액세스 재발급용 JWT | **30일** | 동일 |

- **운영(HTTPS):** `Secure=true`, **`SameSite=None`**, **`Domain=.kroaddy.site`** — `web.kroaddy.site` ↔ `api.kroaddy.site`처럼 **크로스 사이트**에서도 쿠키가 붙도록 설계.
- **로컬(HTTP):** `Secure=false`, **`SameSite=Lax`**, 도메인 미설정(호스트 전용).
- Set-Cookie는 **`ResponseCookie`**로 생성합니다. 구현 주석에 따르면, 구식 `Cookie` + `SameSite` 속성 조합은 Spring 직렬화 과정에서 **HttpOnly가 빠질 수 있어** 이 방식을 씁니다.
- 운영에서 예전 방식으로 남은 **host-only 쿠키**와 새 쿠키가 겹치지 않도록, 발급·삭제 시 **동명 쿠키를 여러 번 Set-Cookie로 정리**하는 로직이 있습니다.

**ALB/Nginx SSL 종료:** 콜백·`/api/auth/*`에서 HTTPS 여부는 `request.isSecure()`만 쓰지 않고 **`X-Forwarded-Proto: https`**를 우선 봅니다 (`AuthController`).

#### OAuth 로그인 직후(웹)

구글·카카오·네이버 콜백에서 내부 사용자 ID로 **JWT 액세스·리프레시**를 만든 뒤, **둘 다 HttpOnly 쿠키**로 내려보냅니다. **리프레시 JWT 원문은 DB에 넣지 않고**, `TokenHashUtil`로 **HMAC-SHA256 해시**만 User 테이블에 저장합니다.

**모바일 딥링크**처럼 쿠키를 쓸 수 없는 경우에는 리다이렉트 URL에 **쿼리로 토큰을 실을 수밖에 없는** 예외 경로가 있고, 그건 보안상 덜 이상적이지만 기기 제약상의 타협입니다.

#### 액세스 토큰이 요청에 실리는 순서 (`JwtAuthenticationFilter`)

필터는 토큰을 다음 **우선순위**로 꺼냅니다.

1. **`access_token` HttpOnly 쿠키** (웹 기본, 보안상 최우선)
2. **`Authorization: Bearer …`** (SSE, 모바일 등)
3. **`?token=`** 쿼리 (레거시 SSE 폴백)

유효한 JWT이면 클레임에서 `sub`(내부 userId), `provider`를 읽고, **`TokenService.isRevoked(provider, userId)`**가 true면 **인증을 올리지 않고** 통과시킵니다. Redis에 **`REVOKED:{provider}:{userId}`** 키가 있으면 곧바로 로그아웃·강제 폐기로 간주하는 **블랙리스트(세션 무효화)** 패턴입니다. Redis 장애 시에는 `false`로 폴백해 **서명 검증만으로 진행**(degraded)합니다.

#### Spring Security와 “인가”의 역할 분담 (`SecurityConfig`)

- **세션:** `STATELESS` — 서버 세션에 로그인 상태를 두지 않고 JWT 중심.
- **`/api/**` CSRF:** API는 JWT 기반이라 **CSRF 검사를 `/api/**` 등에 대해 무시**합니다.
- **`authorizeHttpRequests`:** OAuth 콜백·`/api/auth/refresh`·`/api/auth/logout` 등은 **`permitAll`**, 그 외도 코드상 **`anyRequest().permitAll()`** 입니다. 즉 **Spring Security가 경로별로 401을 쏘는 구조가 아니라**, `JwtAuthenticationFilter`가 **있으면** `SecurityContext`에 `ROLE_USER`를 채우고, **실제 “로그인 필요” 판단은 각 컨트롤러·서비스**에서 `SecurityContext`를 보는 방식입니다.

#### `/api/auth/refresh` — 갱신·RTR·Redis Grace

- **리프레시 입력:** 기본은 **`refresh_token` 쿠키**; 없으면 **JSON body의 `refresh_token`**(모바일).
- 동일 이름 쿠키가 여러 개면(마이그레이션·host-only 공존) **후보를 모아 순차 검증**합니다.
- 리프레시 JWT 검증 후, User 테이블의 **저장 해시와 요청 토큰의 해시**가 맞는지 확인합니다.
- **Refresh Token Rotation:** 새 리프레시 JWT를 발급하고 DB 해시를 갱신합니다. 직전 해시는 Redis **`GRACE:{provider}:{userId}`**에 **30초 TTL**로 넣어, 프론트가 동시에 refresh를 여러 번 때려 **하나는 성공·하나는 401** 나는 레이스를 완화합니다.
- 성공 시 **새 액세스·새 리프레시**를 다시 HttpOnly 쿠키로 내려주고, 응답 body에도 `access_token` / `refresh_token`을 넣어 **모바일이 저장할 수 있게** 합니다.

#### `/api/auth/logout` vs `/api/oauth/logout`

- **`POST /api/auth/logout`:** 쿠키 기반. 리프레시에서 userId·provider를 뽑아 **User 테이블 refresh 해시 제거**, `TokenService.deleteTokens` 호출, **`access_token`·`refresh_token` 쿠키 만료**.
- **`TokenService.deleteTokens`:** Redis에 남아 있던 예전 access/refresh 키를 지우는 게 아니라, 현재 구현은 **`REVOKED` 마커를 약 900초(액세스 TTL과 동일)** 설정하는 쪽입니다. 주석상 **Redis는 블랙리스트·유예 전용**에 가깝습니다.
- **`POST /api/oauth/logout`:** **`Authorization: Bearer`**로 액세스 JWT를 받아 동일하게 `deleteTokens`(REVOKED) 처리하는 **별 경로**(레거시·헤더 기반 클라이언트용).

#### JWT 클레임 (`JwtTokenProvider`)

- 액세스 JWT는 `provider`, `type=access`, 만료, **`sub`=내부 사용자 ID** 등을 담습니다. OAuth 사용자 정보 맵에 제3자 **`sub`**가 들어와도 **추가 클레임을 먼저 넣고 마지막에 `subject(userId)`를 고정**해, 내부 ID가 덮이지 않도록 되어 있습니다.
- 기본 만료: 액세스 **15분**, 리프레시 **30일**(밀리초 설정).

#### Redis 키 패턴 요약 (`TokenService`)

| 키/용도 | 설명 |
|---------|------|
| `REVOKED:{provider}:{userId}` | 로그아웃 후 해당 사용자 JWT를 필터에서 무효화 |
| `GRACE:{provider}:{userId}` | RTR 직후 30초, 구 리프레시 해시 유예 |
| `code:{provider}:{code}` | (일부 플로우) Authorization code ↔ state 저장·일회 검증 |
| `token:{provider}:{userId}:access` / `:refresh` | **deprecated** — 주석상 리프레시는 DB 해시로 이전됨 |

Redis 연결 실패 시에는 로그만 남기고 **로그인 자체는 가능하게** 두는 경로와, 필터의 REVOKED 확인이 **완화되는** 경로가 코드에 있습니다.

#### (낭독) 마무리 한 문장

정리하면, **브라우저에는 HttpOnly 쿠키로 짧은 액세스·긴 리프레시를 싣고**, **DB에는 리프레시 원문 대신 해시만**, **Redis에는 로그아웃 무효화와 갱신 레이스 완화**를 두는 셋이 맞물려 있습니다.

### 3.4 Flutter 앱 — 토큰 저장·Bearer 인가·갱신 (`flutter_secure_storage` + Dio)

웹과 달리 앱은 **브라우저 쿠키를 쓰지 않는** 쪽이 정책입니다. 대신 **OS 보안 저장소**에 JWT를 두고, API마다 **`Authorization: Bearer`**로 붙입니다. 게이트웨이 `JwtAuthenticationFilter`는 쿠키 다음 순위로 **Bearer**를 이미 지원하므로, **같은 JWT·같은 게이트웨이**와 맞물립니다.

#### 저장 방식

- **라이브러리:** `flutter_secure_storage` (`FlutterSecureStorage`)
- **래퍼:** `TokenStore` (`lib/core/auth/token_store.dart`)
  - 키 `access_token`, `refresh_token`으로 **OS 보안 저장소**(Android Keystore / iOS Keychain 계열)에 저장
- **정책:** 주석 기준으로 **쿠키 기반 인증은 쓰지 않고**, **액세스 토큰도 디스크(보안 저장소)에 남겨** 오프라인·불안정한 네트워크에서도 앱 진입·복구를 가능하게 함

로그인·OAuth 콜백 시 **`writeTokens`**로 AT/RT를 쓰고, 로그아웃·갱신 실패 시 **`clear()`**로 둘 다 지웁니다.

#### 인가(Authorization) — API 요청에 붙는 방식

- **`dioProvider`에 연결된 `AuthInterceptor`** (`lib/core/network/auth_interceptor.dart`)
- **요청마다** `TokenStore.readAccessToken()`으로 AT를 읽고, 있으면  
  **`Authorization: Bearer <access_token>`** 헤더를 붙임

즉 앱 경로에서는 서버가 기대하는 형태가 **Bearer JWT**입니다 (웹의 HttpOnly 쿠키 우선순위와 대비).

#### 만료·갱신 로직

1. **앱 기동 (`AuthController._restoreSession`)**
   - Secure Storage에서 AT 읽기
   - JWT payload의 **`exp`를 로컬에서 파싱**해 만료 전이면 **네트워크 없이** `AuthState`에 AT 반영
   - 만료됐거나 없으면 RT로 **`POST /api/auth/refresh`** 호출 (`AuthService.refreshAccessToken`) → 새 AT(·RT)를 `TokenStore`에 저장 (앱 코드·베이스 URL에 따라 상대 경로만 `auth/refresh` 형태로 보일 수 있음)

2. **API 호출 중 (`AuthInterceptor`)**
   - **HTTP 401**이면 refresh 후 **한 번 재시도** (`extra["retried"]`로 중복 방지)
   - **게이트웨이 레거시:** HTTP 200인데 body에 `code: 401`이면 동일하게 refresh 후 재시도
   - refresh 실패 시 **`TokenStore.clear()`** 후 에러 전파

3. **동시에 여러 요청이 401**이 나와도 **`_refreshing` Future**로 refresh를 **한 번만** 타도록 직렬화

#### JWT 페이로드 활용 (클라이언트만 디코딩)

`jwt_claims.dart`에서 **Base64URL 디코딩만** 하고 **서명 검증은 하지 않음**(일반적인 모바일 패턴; 최종 검증은 서버).

- `getUserIdFromToken`: `sub` / `userId` / `id`
- `getAppUserIdFromToken`: `app_user_id` / `appUserId` / `userId` (게이트웨이 클레임에 맞춘 우선순위)
- `getNicknameFromToken`: `nickname` / `name` / `preferred_username`

플래너·투어스타 등에서 **user_id**를 꺼낼 때 이 유틸을 사용합니다.

#### 로그인 시 토큰이 들어오는 경로 (요약)

- OAuth 딥링크 `kroaddy://auth?...&token=...&refresh_token=...` → `_tryConsumeInitialOAuthCallback`에서 `writeTokens`
- `AuthRepository.signInWithProvider` 등으로 받은 토큰도 저장소·`AuthState`에 반영 (repository 구현과 연동)

#### (낭독) 한 줄 요약

앱에서는 JWT를 **`flutter_secure_storage`에 AT/RT로 저장**하고, API는 **`AuthInterceptor`로 Bearer 인가**하며, 만료는 **`exp` 로컬 판단 + `POST /api/auth/refresh` + 401(및 body 401) 시 자동 갱신·1회 재시도**로 맞춥니다.

---

## 4. 게이트웨이 → 다운스트림 연결

환경변수 `AI_SERVICE_*`로 각 백엔드 URL을 받습니다. 루트 `docker-compose.yaml` 기준 예시는 다음과 같습니다.

| 방향 | 요약 |
|------|------|
| **클라이언트 → 게이트웨이** | HTTPS, 단일 도메인 (예: `api.kroaddy.site`) |
| **게이트웨이 → 내부 서비스** | Docker 서비스명·포트, 예: `http://planer:8003`, `http://news:8005` 등 |
| **공용 네트워크** | `kroaddy-net` 브리지 — 컨테이너 간 이름 기반 DNS |

경로별 대표 매핑(요약):

- `/api/v1/news`, `/api/v1/news/**` → **news** (8005)
- `/api/v1/planner/**`, `/api/v1/user-content/**`, `/api/v1/k-content/**`, `/api/v1/weather/**`, `/api/v1/maps/**` 등 → **planer** (8003)
- `/api/v1/user-profile/**` → **profile** (8004, compose 서비스명 `profile`, 게이트웨이 env는 `user_info` 호스트로 매핑되는 구성)
- `/guide`, `/guide/**`, `/api/v1/festivals/**` → **guide** (8002)
- Tourstar 전용 경로·정적 경로 rewrite → **tourstar** (8010)

즉 **TLS 종료·인증 정책·경로 라우팅**은 게이트웨이에서 하고, 도메인별 비즈니스는 뒤 서비스에 위임합니다.

---

## 5. 마이크로서비스별 기술 스택·역할

### 5.1 planer (`planer`, 포트 8003)

- **Python 3.11**, **FastAPI**, **Uvicorn**
- 일정·루트: **LangGraph**, **LangChain**; LLM: **Google Gemini**, **OpenAI** 계열 폴백
- DB: **SQLAlchemy async**, **asyncpg**, **Alembic**; 객체 스토리지: **AWS S3** (`boto3`, presigned URL 패턴)
- 이미지: **NudeNet**, **ONNX Runtime**, **Pillow**; 일부 수집: **Playwright**
- Standard 플래너: L1/L2 캐시, 옵션 **Redis** 기반 LangGraph 체크포인트 등 — 상세는 [`planer-standard-architecture.md`](./planer-standard-architecture.md)

**내부 MSA 호출:** 플래너는 `GUIDE_SERVICE_URL`, `USER_INFO_SERVICE_URL`로 **가이드·프로필 서버를 서버 간 HTTP**로 호출합니다. “요청이 게이트웨이 → 플래너”로만 흐르는 것이 아니라, 플래너가 **다른 마이크로서비스를 오케스트레이션**하는 구조가 있습니다.

### 5.2 profile (`profile`, 포트 8004)

- **FastAPI**, **SQLAlchemy 2 async**, **asyncpg**, **Alembic**, **Pydantic**
- 여행 개인화 프로필 저장·조회; DB는 **PostgreSQL**
- 인바운드는 주로 게이트웨이 `/api/v1/user-profile/**` 프록시

### 5.3 news (`news`, 포트 8005)

- **FastAPI**, **feedparser**, **httpx**, **OpenAI** SDK, **PostgreSQL** (`psycopg2`)
- RSS 수집·저장·GPT 가공 파이프라인
- 인바운드: 게이트웨이 경유가 기본; 서비스가 게이트웨이를 역호출하는 구조는 아님

### 5.4 guide (`guide`, 포트 8002)

- 장소·행사 등 가이드 데이터 **FastAPI** 서비스
- `/guide`, `/api/v1/festivals` 등이 게이트웨이를 통해 노출; 플래너 컨텍스트와 연계

### 5.5 tourstar (`tourstar`, 포트 8010)

- **FastAPI**, **LangGraph**, **OpenCV headless**, **Ultralytics**, **pyIQA**, **Pillow** 등 비전·품질 스택
- **PostgreSQL**, **S3**; 모델 아티팩트는 compose에서 볼륨 마운트 예시 있음
- 사진 선별·게시글 생성 등 **무거운 CV·에이전트**를 게이트웨이와 분리

---

## 6. 보안·아키텍처 요약

1. **공개 면은 게이트웨이 중심** — 브라우저·앱은 통합 API 도메인만 사용.
2. **CORS** — 허용 출처에 `web.kroaddy.site`, `www.kroaddy.site`, 로컬 `localhost:3000` 등 명시; `credentials` 허용으로 **쿠키 전송** 가능 (`SecurityConfig`).
3. **인증·토큰** — OAuth2 콜백 후 **JWT**; **웹**은 **HttpOnly 쿠키** 우선; **Flutter 앱**은 **Secure Storage + Bearer** (쿠키 미사용). 게이트웨이 필터는 쿠키 → Bearer → 쿼리 순. 상세는 **3.3절(웹)·3.4절(앱)**.
4. **보안 헤더** — `SecurityConfig`에서 HSTS(1년·includeSubDomains), `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy 등 설정.
5. **비밀 정보** — DB URL, JWT 시크릿, OAuth 클라이언트, AI 키 등은 **환경변수·`.env`** 주입.
6. **서비스 간 통신** — Docker 내부 `http://서비스명:포트`; 운영 시 외부 개방 포트는 필요한 것만 노출하는 패턴과 맞춤.
7. **데이터 경계** — 유저·채팅 등 강한 일관성 도메인은 게이트웨이 쪽 PG·Redis; AI·뉴스·플랜 등은 서비스별로 분리된 PG·캐시·S3를 사용하는 식의 **책임 분리**.

---

## 7. 배포·운영 (요약)

- **Docker** 이미지 빌드 → **GitHub Actions**로 **Docker Hub** 푸시 → **EC2** 등에서 `pull` / `docker compose` 구동.
- 프론트 웹(Vercel 등)은 환경변수로 게이트웨이 URL만 맞추면 동일 API를 사용.

---

## 8. 마무리 멘트

정리하면, **Java Spring 게이트웨이**가 **인증·코어 API·역프록시**를 담당하고, **Python FastAPI** 마이크로서비스들이 **AI 플래닝·프로필·뉴스·가이드·비전**을 나눠 맡으며, 그 아래에서 **PostgreSQL·Redis·S3**와 **Gemini·OpenAI·지도·날씨·RSS**가 연결되는 구조입니다. 이상입니다. 질문 받겠습니다.

---

## 부록: 발표 팁

- **슬라이드 한 장**: `클라이언트 → api.kroaddy.site (Spring MVC + Gateway MVC) → FastAPI들 → PG / Redis / S3`
- **인증만 강조할 때 (웹)**: `OAuth 콜백 → HttpOnly(access+refresh) + DB(리프레시 해시) → 요청마다 필터(JWT+REVOKED) → /api/auth/refresh(RTR+Grace)` 한 줄 다이어그램.
- **인증만 강조할 때 (앱)**: `딥링크/Repository → TokenStore(Secure) → Dio+AuthInterceptor(Bearer) → 401 시 /api/auth/refresh 직렬화·1회 재시도`.
- **시간이 짧을 때**: planer의 LangGraph·S3·guide/profile 내부 호출만 강조하고, 나머지는 “동일 패턴의 FastAPI + 전용 저장소”로 묶어 설명.

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [api-kroaddy-site.md](./api-kroaddy-site.md) | 게이트웨이 스택·라우트·CORS·인프라 |
| `gateway/.../CookieUtil.java`, `JwtAuthenticationFilter.java`, `SecurityConfig.java`, `AuthController.java`, `TokenService.java`, `JwtTokenProvider.java` | 쿠키·JWT·Redis·인가 구현 원본 |
| [flutter-kroaddy-auth.md](./flutter-kroaddy-auth.md) | Flutter 로그인·토큰·라우팅 등(앱 전반과 연계 시) |
| `lib/core/auth/token_store.dart`, `lib/core/network/auth_interceptor.dart`, `lib/.../jwt_claims.dart` (앱 루트 기준) | Secure Storage·Bearer·클레임 유틸 구현 |
| [kroaddy-project-technical-spec.md](./kroaddy-project-technical-spec.md) | 전체 기술서·ASCII 아키텍처 |
| [planer-kroaddy-site.md](./planer-kroaddy-site.md) | 플래너 서비스 개요 |
| [planer-standard-architecture.md](./planer-standard-architecture.md) | Standard 플래너 그래프·캐시·Redis 체크포인트 |
| [profile-kroaddy-site.md](./profile-kroaddy-site.md) | 프로필 서비스 |
| [news-kroaddy-site.md](./news-kroaddy-site.md) | 뉴스 서비스 |
