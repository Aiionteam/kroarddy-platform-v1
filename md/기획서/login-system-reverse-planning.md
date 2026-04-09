로그인 시스템 기획서

문서 버전: v0.2
대상 시스템: backend/api.kroaddy.site (Spring Boot Gateway)

1. 개요

이 문서는 Kroaddy 로그인 시스템의 목표, 정책, 구조를 제품 기획 관점에서 정리한 문서입니다.
서비스 초기 설계 단계에서 기준으로 삼을 수 있도록 사용자 경험, 보안 원칙, 운영 기준을 함께 명시했습니다.

로그인 시스템의 중심 요구사항은 다음과 같습니다.
- 소셜 로그인 중심 인증(구글, 카카오, 네이버)
- 웹과 모바일을 동시에 지원하는 토큰 전달 구조
- 서버 측 세션 없이 JWT 기반으로 인증 상태를 처리하는 구조
- 로그아웃 및 토큰 회전(Rotation) 시 보안 사고를 줄이는 운영 설계

로그인 구조는 API Gateway 한 곳에서 로그인 진입, 콜백 처리, JWT 발급, 토큰 갱신, 로그아웃까지 일관되게 처리하도록 설계했습니다.

2. 기획 의도

2-1. 기획 배경

로그인 기능은 서비스 전 영역과 연결되기 때문에, 초기부터 기준을 명확하게 정의하는 것이 중요했습니다.
특히 인증 시스템은 작은 정책 변경만으로도 전체 서비스 안정성에 영향을 줄 수 있어, 구현 전에 원칙과 흐름을 문서화하는 것을 우선했습니다.

2-2. 사용자 관점 의도

- 사용자는 로그인 방식(구글/카카오/네이버)이 달라도 동일한 경험을 가져야 했습니다.
- 웹 사용자는 페이지 이동만으로 로그인 상태가 복원되어야 했습니다.
- 모바일 사용자는 딥링크 환경에서도 인증 결과를 안정적으로 전달받아야 했습니다.
- 로그아웃 후에는 즉시 요청이 차단되어야 했습니다.

2-3. 운영 관점 의도

- 인증 로직을 게이트웨이에 집중시켜 서비스별 중복 구현을 줄였습니다.
- Refresh Token 원문 저장을 피하고 해시 저장으로 유출 위험을 낮췄습니다.
- 동시 토큰 갱신 경쟁 조건(Race Condition)을 완화하기 위해 Grace Period를 도입했습니다.
- Redis 장애 시 전체 로그인을 중단하지 않고, 제한적 저하 모드로 동작하도록 설계했습니다.

2-4. 보안 관점 의도

- 웹은 HttpOnly 쿠키 기반 인증으로 XSS 노출 면적을 줄였습니다.
- 운영 HTTPS 환경에서는 SameSite=None, Secure, domain=.kroaddy.site 정책을 적용해 크로스 서브도메인 전송을 보장했습니다.
- 로그아웃 시 REVOKED 마커를 두어 만료 전 Access Token 재사용을 방지했습니다.
- 토큰 갱신 시 Refresh Token Rotation을 적용해 장기 토큰 탈취 위험을 줄였습니다.

3. UI

UI 캡처 삽입 예정

4. 시스템 설명

4-1. 컴포넌트 구성

- API Gateway: Spring Boot 3.5, Security Filter, OAuth 컨트롤러, Auth 컨트롤러
- OAuth Provider 처리: /api/google, /api/kakao, /api/naver
- 토큰 관리: JwtTokenProvider, TokenService, CookieUtil
- 사용자 저장소: User 테이블(Refresh Token 해시 저장)
- 상태 저장소: Redis(REVOKED, Grace, 일부 코드 검증 캐시)

4-2. 로그인 흐름

1) 프론트엔드가 /api/{provider}/auth-url 호출
- 서버가 provider별 인증 URL을 생성해 반환합니다.
- state에는 frontend_url과 CSRF 토큰을 함께 인코딩합니다.

2) 사용자가 소셜 인증 완료 후 /api/{provider}/callback 진입
- Authorization Code를 공급자 토큰으로 교환합니다.
- 공급자 사용자 정보를 조회합니다.
- 내부 사용자(User)를 조회하고, 없으면 생성합니다.

3) 내부 JWT 발급
- Access Token과 Refresh Token을 발급합니다.
- Refresh Token은 원문 대신 HMAC-SHA256 해시로 변환해 User 테이블에 저장합니다.
- 재로그인 시 기존 REVOKED 마커를 해제해 즉시 사용 가능 상태로 전환합니다.

4) 쿠키 및 리다이렉트
- 웹: access_token, refresh_token을 HttpOnly 쿠키로 설정하고 /login/callback으로 리다이렉트합니다.
- 모바일 딥링크: 쿠키 사용이 어려운 경우 URL 파라미터로 토큰 전달을 허용합니다.

4-3. 토큰 갱신(Refresh)

엔드포인트: POST /api/auth/refresh

- 우선순위 1: refresh_token 쿠키
- 우선순위 2: 요청 body의 refresh_token(모바일)

검증 단계:
- JWT 서명/만료 검증
- 토큰에서 userId, provider 추출
- User 테이블에 저장된 Refresh Token 해시와 비교
- 불일치 시 복수 쿠키 후보 재검증
- 그래도 불일치하면 Redis Grace Period 해시를 확인

성공 시:
- Refresh Token Rotation 수행
- 이전 토큰 해시는 30초 Grace 키로 보관
- 새 Access/Refresh 쿠키 재설정

4-4. 로그아웃

엔드포인트: POST /api/auth/logout

- Refresh Token 기반으로 사용자 식별
- User 테이블의 Refresh Token 해시 삭제
- Redis에 REVOKED:{provider}:{userId} 키를 Access TTL 수준으로 저장
- Access/Refresh 쿠키 모두 만료 처리

효과:
- 클라이언트가 이전 Access Token을 들고 있어도 필터에서 REVOKED 상태를 보고 차단합니다.

4-5. 인증 필터 동작

JwtAuthenticationFilter 토큰 추출 우선순위:
1) HttpOnly 쿠키 access_token
2) Authorization: Bearer 헤더
3) query 파라미터 token(레거시 SSE 호환)

유효 토큰이면 SecurityContext에 userId와 클레임을 세팅합니다.
토큰이 없거나 유효하지 않아도 SecurityConfig는 기본적으로 permitAll 정책이므로, 세부 인가 판단은 컨트롤러/서비스 레이어에서 수행합니다.

4-6. 쿠키 정책

- 운영 HTTPS:
  - Secure=true
  - SameSite=None
  - Domain=.kroaddy.site
- 로컬 HTTP:
  - Secure=false
  - SameSite=Lax
  - host-only

쿠키 정책 변경 시 stale 쿠키가 남아 중복될 가능성을 고려해, 설정/만료 시 host-only 버전과 domain 버전을 함께 정리하도록 설계했습니다.

4-7. 데이터 및 만료 정책

- Access Token: 15분 또는 설정값 기준
- Refresh Token: 30일 또는 설정값 기준
- REVOKED 키: 기본 15분 수준
- Grace 키: 30초

Refresh Token은 DB 원문 저장을 하지 않고 해시만 저장합니다.

4-8. 예외 및 저하 모드

- Redis 연결 장애 시 TokenService는 degraded mode로 로그만 남기고 가능한 흐름을 유지합니다.
- 단, REVOKED/Grace 검증이 약해질 수 있으므로 운영 모니터링이 필수입니다.
- OAuth 콜백 실패 시 provider와 에러 메시지를 포함해 프론트 /login/callback으로 리다이렉트합니다.

4-9. 공개 엔드포인트(로그인 관련)

- /api/google/auth-url
- /api/google/callback
- /api/kakao/auth-url
- /api/kakao/callback
- /api/naver/auth-url
- /api/naver/callback
- /api/auth/refresh
- /api/auth/logout

4-10. 운영 체크포인트

- 환경변수:
  - JWT_SECRET
  - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
  - KAKAO_REST_API_KEY, KAKAO_CLIENT_SECRET, KAKAO_REDIRECT_URI
  - NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_REDIRECT_URI
  - FRONTEND_URL
  - UPSTASH_REDIS_URL 또는 Redis host/port/password

- CORS:
  - https://web.kroaddy.site
  - http://localhost:3000

- 리다이렉트 URI:
  - 각 공급자 콘솔 등록값과 서버 환경변수가 일치해야 합니다.

4-11. 향후 개선안

- provider별 login/token mock 엔드포인트 정리 및 실제 흐름과 역할 분리
- SecurityConfig의 광범위 permitAll 정책을 점진적 세분 인가 정책으로 전환
- 로그인/토큰 이벤트 감사 로그 표준화
- 모바일 딥링크 토큰 전달 구간의 추가 보호(단기 코드 교환 방식) 검토

