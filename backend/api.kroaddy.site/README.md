# API Gateway (Facade & Proxy Pattern)

`api.tourstory.site`는 **퍼사드(Facade) 패턴**과 **프록시(Proxy) 패턴**을 구현한 API Gateway입니다.

**연결 프론트엔드**: 이 API는 **www.tourstory.site**와만 연동합니다. CORS·OAuth 리다이렉트는 `FRONTEND_URL`(tourstory 도메인) 기준으로 동작합니다. www.hohyun.site는 참고용이며 API 연동 대상이 아닙니다.

## 역할

### 1. 퍼사드 패턴 (Facade Pattern)
- **단일 진입점 제공**: 클라이언트는 복잡한 마이크로서비스 구조를 알 필요 없이 단일 API Gateway를 통해 모든 서비스에 접근
- **통합 인터페이스**: 여러 마이크로서비스를 하나의 통합된 인터페이스로 제공
- **복잡성 숨김**: 내부 마이크로서비스 구조의 복잡성을 클라이언트로부터 숨김

### 2. 프록시 패턴 (Proxy Pattern)
- **요청 라우팅**: 클라이언트 요청을 적절한 백엔드 서비스로 프록시
- **로드 밸런싱**: 여러 인스턴스 간 요청 분산
- **인증/인가**: 중앙 집중식 인증 및 인가 처리
- **CORS 처리**: Cross-Origin Resource Sharing 정책 관리
- **요청/응답 변환**: 요청 및 응답 데이터 변환 및 필터링

## 아키텍처

```
클라이언트 (Frontend)
    ↓
API Gateway (api.aiion.site:8080)  ← 퍼사드 & 프록시
    ↓
    ├─→ Spring Boot Microservices (service.aiion.site)
    │   ├─→ auth-service
    │   ├─→ user-service
    │   ├─→ calendar-service
    │   ├─→ diary-service
    │   └─→ ...
    │
    ├─→ ERP Services (erp.aiion.site)
    │   └─→ inventory-service (Python FastAPI)
    │
    └─→ AI Services (ai.aiion.site)
        ├─→ weather-service (Python FastAPI)
        └─→ crawler-service (Python FastAPI)
```

## 기술 스택

- **Spring Cloud Gateway**: 리액티브 웹 프레임워크 기반 API Gateway
- **Java 21**: 최신 Java 기능 활용
- **Spring Boot 3.5.8**: 최신 Spring Boot 버전
- **Docker**: 컨테이너화된 배포

## 주요 기능

### 1. 라우팅 규칙
- **Path-based Routing**: URL 경로 기반 서비스 라우팅
- **StripPrefix**: 경로 프리픽스 제거 (예: `/user/users` → `/users`)
- **Load Balancing**: 서비스 인스턴스 간 자동 로드 밸런싱

### 2. CORS 설정
- 프론트엔드에서 직접 API 호출 가능
- 허용된 Origin, Method, Header 관리
- Credentials 지원

### 3. 서비스 통합
- **Spring Boot Microservices**: Java 기반 마이크로서비스
- **Python FastAPI Services**: ERP 및 AI 서비스
- **통합 라우팅**: 모든 서비스를 단일 엔드포인트로 통합

## 서비스 라우팅

### Spring Boot Microservices
- `/auth/**` → auth-service:8087
- `/user/**` → user-service:8082
- `/calendar/**` → calendar-service:8084
- `/diary/**` → diary-service:8083
- `/culture/**` → culture-service:8086
- `/healthcare/**` → healthcare-service:8088
- `/account/**` → account-service:8089
- `/pathfinder/**` → pathfinder-service:8090

### ERP Services (Python FastAPI)
- `/inventory/**` → inventory-service:9002

### AI Services (Python FastAPI)
- `/weather/**` → weather-service:9004
- `/crawler/**` → crawler-service:9003

## 실행 방법

### Docker Compose로 실행
```bash
cd api.aiion.site
docker-compose up -d
```

### 로컬 개발
```bash
cd api.aiion.site
./gradlew :server:gateway:bootRun
```

## 환경 변수

- `SPRING_PROFILES_ACTIVE`: Spring 프로파일 (기본값: `docker`)
- `SPRING_DATA_REDIS_HOST`: Redis 호스트 (기본값: `redis`)
- `SPRING_DATA_REDIS_PORT`: Redis 포트 (기본값: `6379`)

## 포트

- **8080**: API Gateway HTTP 포트

## 네트워크

- `spring-network`: 모든 마이크로서비스와 공유하는 Docker 네트워크

## 모니터링

- Gateway 엔드포인트: `/actuator/gateway`
- Health 체크: `/actuator/health`
- Info: `/actuator/info`

## 설계 원칙

1. **단일 책임 원칙**: API Gateway는 라우팅과 프록시 역할만 담당
2. **개방-폐쇄 원칙**: 새로운 서비스 추가 시 Gateway 코드 수정 최소화
3. **의존성 역전 원칙**: Gateway는 서비스 구현 세부사항에 의존하지 않음

## 확장성

- 새로운 마이크로서비스 추가 시 `application.yaml`에 라우팅 규칙만 추가
- 서비스별 독립적인 스케일링 가능
- Gateway는 무상태(stateless) 설계로 수평 확장 가능

