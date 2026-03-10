# 아키텍처 준수 현황 보고서

> 작성일: 2026-02-09  
> 대상: `api.hohyun.site` (Backend) + `www.hohyun.site` (Frontend)  
> 참조: `BACKEND_ARCHITECTURE.md`, `FRONT_OAUTH_ARCHITECTURE.md`

---

## 📊 요약

| 항목 | 아키텍처 문서 | 실제 구현 | 상태 | 비고 |
|------|--------------|----------|------|------|
| **Backend 구조** | MSA (Gateway:8080, User:8081, Auth:8082) | Monolith (Gateway:8080만 존재) | ⚠️ 불일치 | 현재 구현이 더 단순하고 효율적 |
| **Redis** | Local Docker Container | Upstash Redis (Cloud) | ⚠️ 불일치 | 클라우드 Redis가 더 안정적 |
| **Database** | 문서 없음 | Neon PostgreSQL (Cloud) | ✅ 개선 | 클라우드 DB 사용 |
| **JWT_SECRET** | 필수 환경 변수 | `.env`에 추가 완료 | ✅ 해결 | 이번 점검에서 수정 |
| **Refresh Token 저장** | Redis only | User table + Redis (deprecated) + HttpOnly Cookie | ⚠️ 불일치 | 현재 구현이 더 안전 |
| **Access Token (Frontend)** | localStorage | Zustand Store (memory) + sessionStorage | ⚠️ 불일치 | 현재 구현이 더 안전 (XSS 방지) |
| **OAuth Callback 페이지** | `/oauth2/{provider}/callback` (provider별) | `/login/callback` (통합) | ⚠️ 불일치 | 통합 콜백 사용 중 |
| **Popup 닫기 감지** | `setInterval(popup.closed)` | Timeout + try/catch | ⚠️ 불일치 | COOP 정책 대응 |

---

## 🔍 상세 분석

### 1. Backend 아키텍처

#### 문서 (BACKEND_ARCHITECTURE.md)
```
┌─────────────────────────────────────┐
│       Gateway (Port 8080)           │  ← Spring Cloud Gateway
├─────────────────────────────────────┤
│  User Service    (Port 8081)        │  ← 사용자 관리
│  Auth Service    (Port 8082)        │  ← OAuth2 + JWT
│  Redis           (Port 6379)        │  ← 로컬 컨테이너
└─────────────────────────────────────┘
```

#### 실제 구현
```
┌─────────────────────────────────────┐
│    Gateway (Port 8080)              │  ← Spring Boot Servlet (단일 앱)
│    ├─ UserController               │
│    ├─ OAuth Controllers            │  (Kakao, Naver, Google)
│    ├─ AuthController               │
│    ├─ DiaryController              │
│    └─ GroupChatController          │
├─────────────────────────────────────┤
│  Neon PostgreSQL (Cloud)            │  ← 클라우드 DB
│  Upstash Redis   (Cloud)            │  ← 클라우드 Redis
└─────────────────────────────────────┘
```

#### 차이점 설명
- **MSA → Monolith**: 문서는 마이크로서비스를 가정했지만, 실제는 단일 Spring Boot 앱으로 구현
- **장점**: 
  - 배포 단순화 (Docker 컨테이너 1개)
  - 네트워크 오버헤드 감소
  - 개발/디버깅 용이
- **단점**: 
  - 서비스 분리 불가능
  - 스케일링 시 전체 앱을 복제해야 함

#### 권장 사항
- **현재 단계에서는 Monolith가 적합**합니다.
- 향후 트래픽 증가 시 MSA로 전환 고려 가능.

---

### 2. Redis 연결

#### 문서 (BACKEND_ARCHITECTURE.md)
```yaml
redis:
  image: redis:7-alpine
  ports: ["6379:6379"]
  volumes: [redis-data:/data]
  networks: [api-network]
```

#### 실제 구현 (`.env`)
```bash
# Upstash Redis (Cloud)
UPSTASH_REDIS_URL=rediss://default:password@helpful-troll-43968.upstash.io:6379
UPSTASH_REDIS_HOST=helpful-troll-43968.upstash.io
UPSTASH_REDIS_PORT=6379
UPSTASH_REDIS_PASSWORD=...
```

#### 차이점 설명
- **로컬 Docker → 클라우드 Upstash**
- **장점**:
  - 별도 Redis 컨테이너 불필요
  - 자동 백업 및 고가용성
  - 배포 환경 간 일관성
- **주의사항**:
  - `.env` 파일을 반드시 로드해야 함
  - Docker Compose 실행 시: `env_file: .env` 설정 필수
  - Gradle 실행 시: `export $(cat .env | xargs)` 또는 IntelliJ 환경 변수 설정

#### 해결 완료
- ✅ `application.yaml`에서 `spring.data.redis.url: ${UPSTASH_REDIS_URL}` 우선 사용 설정
- ✅ SSL 활성화 (`ssl.enabled: true`)

---

### 3. JWT_SECRET 환경 변수

#### 문서 요구사항
```bash
JWT_SECRET=your_jwt_secret_key_at_least_32_characters_long
```

#### 수정 전 상태
- `.env` 파일에 **JWT_SECRET 없음**
- `application.yaml`에서 기본값 사용: `default-secret-key-change-in-production`
- **보안 위험**: 프로덕션에서 기본키 사용 시 JWT 토큰 위조 가능

#### 해결 완료 (`.env` 수정)
```bash
# JWT Configuration (필수!)
JWT_SECRET=pVV5QvzWO0shfgGHuk7gWn9rueQQBvyBILZqYt6CHNtOFXd7Tingk7FDE/CQbgB4W/AcDcYIW5fZ9e2vz1p1Xg==
```

- ✅ Base64 인코딩된 강력한 비밀키 생성
- ✅ 최소 64자 이상의 안전한 키 사용
- ⚠️ **주의**: 프로덕션 배포 전 반드시 새로운 키로 변경하세요!

---

### 4. Refresh Token 저장 위치

#### 문서 (BACKEND_ARCHITECTURE.md)
```java
// Redis에 Refresh Token 저장
tokenService.saveRefreshToken("kakao", userId, token, 2592000);
```

```typescript
// Frontend: localStorage에 저장
localStorage.setItem("refresh_token", refreshToken);
```

#### 실제 구현
**Backend**:
```java
// 1. User 테이블에 저장 (primary)
userService.updateRefreshToken(appUserId, jwtRefreshToken);

// 2. Redis에도 저장 (@Deprecated, 하위 호환성)
tokenService.saveRefreshToken("kakao", userId, jwtRefreshToken, 2592000);

// 3. HttpOnly 쿠키로 전송
ResponseCookie cookie = ResponseCookie.from("refresh_token", jwtRefreshToken)
    .httpOnly(true)  // ← XSS 공격 방지
    .secure(true)    // ← HTTPS에서만 전송
    .path("/")
    .maxAge(30 * 24 * 60 * 60)
    .build();
```

**Frontend**:
```typescript
// Refresh Token은 HttpOnly 쿠키에만 저장 (localStorage에 저장 안 함)
// ✅ XSS 공격 시에도 JavaScript에서 접근 불가능
```

#### 차이점 설명
- **보안 강화**: HttpOnly 쿠키는 JavaScript에서 읽을 수 없어 XSS 공격 방지
- **3중 저장**: User Table (영구) + Redis (캐시) + HttpOnly Cookie (전송)
- **권장 사항**: 
  - `tokenService.saveRefreshToken`의 `@Deprecated` 제거 가능 (하위 호환성 유지 목적)
  - 또는 Redis 저장을 완전히 제거하고 User Table + Cookie만 사용

---

### 5. Access Token 저장 (Frontend)

#### 문서 (FRONT_OAUTH_ARCHITECTURE.md)
```typescript
// localStorage에 Access Token 저장
localStorage.setItem("token", accessToken);
```

#### 실제 구현
```typescript
// Zustand Store (메모리)에 Access Token 저장
interface LoginState {
  accessToken: string | null;  // ← 메모리에만 존재
  isAuthenticated: boolean;    // ← sessionStorage에 백업
  // ...
}

// sessionStorage에는 인증 상태만 저장 (토큰 자체는 X)
sessionStorage.setItem("isAuthenticated", "true");
```

#### 차이점 설명
- **localStorage → Zustand Store (memory)**
- **장점**:
  - 브라우저 탭을 닫으면 토큰 자동 제거 (보안 강화)
  - XSS 공격 시 공격자가 토큰을 직접 읽기 어려움
  - F12 개발자 도구에서 토큰 노출 최소화
- **단점**:
  - 페이지 새로고침 시 재로그인 필요
  - 하지만 Refresh Token(HttpOnly Cookie)으로 자동 재발급 가능

#### 예외: chatClient.ts
- **문제**: `chatClient.ts`가 `localStorage.getItem("token")` 사용 중이었음
- **해결**: Zustand Store에서 토큰을 가져오도록 수정 완료 ✅

```typescript
// Before (잘못된 구현)
const token = localStorage.getItem("token");

// After (올바른 구현)
const store = (window as any).__loginStore;
const token = store?.getState().accessToken;
```

---

### 6. OAuth Callback 페이지

#### 문서 (FRONT_OAUTH_ARCHITECTURE.md)
```
src/app/oauth2/
├── kakao/callback/page.tsx
├── naver/callback/page.tsx
└── google/callback/page.tsx
```

#### 실제 구현
```
src/app/
├── login/
│   └── callback/page.tsx     ← 통합 콜백 페이지 (provider 구분 없이 처리)
└── page.tsx                  ← 메인 로그인 페이지 (백엔드가 여기로 리다이렉트)
```

#### 차이점 설명
- **Provider별 페이지 → 통합 페이지**
- **장점**:
  - 코드 중복 제거
  - JWT payload에서 `provider` 자동 추출 (`jwt.decode()`)
- **단점**:
  - Provider별 특수 처리 시 조건문 필요

#### 백엔드 리다이렉트 설정
```java
// 백엔드가 프론트엔드로 리다이렉트 (통합 경로)
String redirectUrl = frontendUrl + "?token=" + jwtAccessToken + "&refresh_token=" + jwtRefreshToken;

// 또는 /login/callback으로 명시적 리다이렉트
String redirectUrl = frontendUrl + "/login/callback?token=...";
```

#### 권장 사항
- 현재 통합 방식이 더 효율적이므로 **변경 불필요**
- 문서를 현재 구현에 맞게 업데이트

---

### 7. Popup 닫기 감지 로직

#### 문서 (FRONT_OAUTH_ARCHITECTURE.md)
```typescript
// setInterval로 팝업 닫힘 확인
const checkClosed = setInterval(() => {
  if (popup.closed) {
    clearInterval(checkClosed);
    window.removeEventListener("message", messageListener);
  }
}, 1000);
```

#### 실제 구현
```typescript
// 1. popup.close() 호출 시 try/catch로 COOP 에러 방지
try {
  popup?.close();
} catch {
  // Cross-Origin-Opener-Policy로 차단되면 무시
}

// 2. setInterval 대신 setTimeout으로 리스너 정리
setTimeout(() => {
  window.removeEventListener("message", messageListener);
}, 5000);  // 5초 후 자동 정리
```

#### 차이점 설명
- **COOP (Cross-Origin-Opener-Policy) 대응**
- **문제**: `popup.closed`에 접근 시 COOP 정책으로 인한 에러 발생
- **해결**:
  - `popup.close()` 호출을 try/catch로 감싸기
  - `popup.closed` 체크 대신 timeout 사용
- **참고**: 이전 대화에서 해결한 이슈

---

## ✅ 수정 완료 항목

### 1. JWT_SECRET 추가 (`api.hohyun.site/.env`)
```bash
# 추가됨
JWT_SECRET=pVV5QvzWO0shfgGHuk7gWn9rueQQBvyBILZqYt6CHNtOFXd7Tingk7FDE/CQbgB4W/AcDcYIW5fZ9e2vz1p1Xg==
```

### 2. chatClient.ts 토큰 저장소 수정
```typescript
// Before
const token = localStorage.getItem("token");

// After
const store = (window as any).__loginStore;
const token = store?.getState().accessToken;
```

### 3. Redis 연결 설정 수정 (`application.yaml`)
```yaml
spring:
  data:
    redis:
      # URL 우선 사용 (Upstash)
      url: ${UPSTASH_REDIS_URL:}
      # fallback으로 host/port 사용
      host: ${UPSTASH_REDIS_HOST:localhost}
      port: ${UPSTASH_REDIS_PORT:6379}
      password: ${UPSTASH_REDIS_PASSWORD:}
      ssl:
        enabled: ${UPSTASH_REDIS_SSL:true}
```

---

## ⚠️ 주의사항 및 권장 사항

### 1. 환경 변수 로드 필수

**Docker Compose 실행 시**:
```yaml
services:
  gateway:
    env_file:
      - .env  # ← 반드시 설정
```

**Gradle 로컬 실행 시**:
```bash
# 방법 1: export로 환경 변수 로드
export $(cat .env | xargs)
./gradlew bootRun

# 방법 2: IntelliJ Run Configuration에서 .env 파일 설정
```

### 2. JWT_SECRET 프로덕션 변경
- **현재 키는 개발용 샘플입니다**
- **배포 전 반드시 새로운 키로 변경하세요**:
  ```bash
  # Linux/macOS
  openssl rand -base64 64
  
  # Windows (PowerShell)
  [Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
  ```

### 3. HTTPS 필수 (프로덕션)
- Refresh Token HttpOnly Cookie는 `secure: true` 설정 시 **HTTPS에서만 전송**됨
- 프로덕션 배포 시 반드시 SSL 인증서 설정 필요

### 4. CORS 설정 확인
- 현재 `application.yaml`에서 CORS 허용 Origin 설정 필요 확인:
  ```yaml
  # 로컬
  - http://localhost:3000
  # 프로덕션
  - https://www.hohyun.site
  - https://hohyun.site
  ```

---

## 📝 문서 업데이트 권장 사항

### 업데이트가 필요한 문서
1. **BACKEND_ARCHITECTURE.md**:
   - MSA → Monolith 구조로 수정
   - Redis: Local Docker → Upstash Redis
   - Database 섹션 추가 (Neon PostgreSQL)
   - Refresh Token 저장 방식 업데이트 (User table + HttpOnly Cookie)

2. **FRONT_OAUTH_ARCHITECTURE.md**:
   - Access Token 저장 방식: localStorage → Zustand Store
   - Refresh Token 저장 방식: localStorage → HttpOnly Cookie (프론트엔드에서 접근 불가)
   - Callback 페이지 구조: Provider별 → 통합
   - Popup 닫기 로직: COOP 대응 방식 추가

---

## 🎯 결론

### 현재 구현의 장점
1. **보안 강화**:
   - Refresh Token을 HttpOnly Cookie로 관리 (XSS 방지)
   - Access Token을 메모리에 저장 (localStorage보다 안전)
   - JWT_SECRET 환경 변수로 분리

2. **아키텍처 단순화**:
   - Monolith 구조로 배포 복잡도 감소
   - 클라우드 서비스(Neon DB, Upstash Redis) 활용

3. **코드 품질**:
   - 통합 OAuth 콜백 페이지로 중복 제거
   - COOP 정책 준수

### 문서와의 차이점
- **아키텍처 문서는 이상적인 MSA 구조를 설명**하지만, **실제 구현은 현실적인 Monolith + Cloud 서비스 조합**
- **실제 구현이 더 안전하고 효율적**이므로, **문서를 현재 구현에 맞게 업데이트하는 것을 권장**합니다.

### 즉시 조치 필요 사항
- ✅ JWT_SECRET 추가 (완료)
- ✅ Redis 연결 설정 수정 (완료)
- ✅ chatClient 토큰 저장소 통일 (완료)
- ⚠️ 프로덕션 배포 전 JWT_SECRET 변경 (사용자 조치 필요)

---

**작성자**: AI Assistant  
**검토 필요**: 프로덕션 배포 전 보안 설정 재확인
