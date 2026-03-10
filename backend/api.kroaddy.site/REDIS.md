# Redis(Upstash) 연결 가이드

## Redis가 연결되지 않을 때 확인할 것

### 1. Docker에서 실행하는 경우

**증상**: `UnknownHostException: helpful-troll-43968.upstash.io: Name does not resolve`

**원인**: 컨테이너 안에서 외부 도메인(Upstash) DNS 해석이 안 됨.

**해결**:
- `docker-compose.yml`에 DNS가 설정되어 있는지 확인:
  ```yaml
  dns:
    - 8.8.8.8
    - 8.8.4.4
  ```
- 적용 후 재시작:
  ```bash
  docker compose down
  docker compose up -d
  ```

**환경 변수 로드**:
- `env_file: .env`가 있으면 컨테이너 시작 시 `.env`가 자동 로드됨.
- `UPSTASH_REDIS_URL`이 `.env`에 있고 `rediss://...` 형식인지 확인.

---

### 2. 로컬(Gradle/IDE)에서 실행하는 경우

**증상**: Redis 연결 실패 또는 `localhost:6379`로 접속 시도.

**원인**: `.env`가 자동으로 로드되지 않음. Spring은 시스템 환경 변수만 읽음.

**해결**:
- 터미널에서 환경 변수 로드 후 실행:
  ```bash
  # PowerShell (Windows)
  Get-Content .env | ForEach-Object { if ($_ -match '^([^#][^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process') } }
  ./gradlew bootRun

  # 또는 한 줄로 (Git Bash / WSL)
  export $(grep -v '^#' .env | xargs)
  ./gradlew bootRun
  ```
- IntelliJ: Run → Edit Configurations → 해당 앱 → Environment variables에 `UPSTASH_REDIS_URL=rediss://...` 등 추가하거나, "Load from .env" 플러그인 사용.

---

### 3. URL 형식

- Upstash는 **TLS 필수**이므로 반드시 `rediss://` (s 두 개) 사용.
- 예: `rediss://default:비밀번호@호스트:6379`
- `UPSTASH_REDIS_SSL`이 `true`여야 함 (기본값 true).

---

### 4. Redis가 안 되어도 로그인은 됨

`TokenService`에서 Redis 예외를 잡고 로그만 남기므로, **Redis 연결 실패 시에도 로그인·토큰 발급·리다이렉트는 정상 동작**합니다.  
다만 Access Token을 Redis에 저장하지 못해, 서버 재시작 전까지는 해당 토큰으로 API 호출이 가능하고, Redis 기반 토큰 무효화(블랙리스트)는 동작하지 않습니다.

---

### 5. 요약 체크리스트

| 환경        | 확인 사항 |
|------------|-----------|
| Docker     | `dns: 8.8.8.8`, `env_file: .env`, `UPSTASH_REDIS_URL` in .env |
| 로컬 실행  | `.env` 내용을 환경 변수로 로드 후 `bootRun` |
| 공통       | URL이 `rediss://` 로 시작하는지, 비밀번호/호스트가 맞는지 |
