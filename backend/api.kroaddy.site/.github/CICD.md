# API Gateway CI/CD: GitHub → Docker Hub (EC2는 직접 pull & run)

**대상**: `backend/api.kroaddy.site` (Spring Boot Gateway, 포트 8080)

**흐름**
1. **GitHub Actions** → 빌드 → **Docker Hub** 로 이미지 push
2. **EC2** 에서 직접 `docker pull` 후 `docker run` (수동 또는 cron으로 자동화)

**장점**: GitHub에 EC2 PEM 키를 넣을 필요 없음. 보안·설정 모두 단순함.

---

## 1. 내가 해야 할 플로우 (순서대로)

### Step 1. Docker Hub 준비

1. [Docker Hub](https://hub.docker.com) 로그인
2. **Repositories** → **Create Repository**
   - 이름: `api.kroaddy.site` (또는 원하는 이름)
   - Visibility: Private 또는 Public
3. **Account Settings** → **Security** → **New Access Token**
   - 토큰 생성 후 복사 (한 번만 표시됨)

### Step 2. GitHub Secrets (Docker Hub만)

**저장소** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret 이름 | 값 | 필수 |
|-------------|-----|------|
| `DOCKER_USERNAME` | Docker Hub 로그인 아이디 | ✅ |
| `DOCKER_PASSWORD` | Docker Hub Access Token (또는 비밀번호) | ✅ |

EC2/PEM 관련 시크릿은 **필요 없음**.

### Step 3. 워크플로 (레포 = api.kroaddy.site 기준)

**레포 루트가 api.kroaddy.site** 인 경우, 실제 폴더 구조에 맞게 이미 설정되어 있음:

- `context: .` — Docker 빌드 컨텍스트 = 레포 루트 (build.gradle, gateway/ 있는 곳)
- `file: ./gateway/Dockerfile` — Dockerfile 실제 경로
- `paths`: `gateway/**`, `build.gradle`, `settings.gradle`, `gradle/**` 변경 시에만 빌드

워크플로 파일 위치: **`.github/workflows/deploy-api-gateway.yml`** (레포 루트의 .github 아래)

### Step 4. 배포 실행 (GitHub 쪽)

- **자동**: `main` push 시 `backend/api.kroaddy.site/**` 변경 시 빌드 후 Docker Hub에 push
- **수동**: **Actions** → **Build & Push API Gateway to Docker Hub** → **Run workflow**

### Step 5. EC2에서 할 일 (직접 pull & run)

EC2에 SSH 접속한 뒤:

```bash
# Docker Hub 로그인 (Private 레포면 필수)
docker login -u <DOCKER_USERNAME> -p <DOCKER_PASSWORD>

# 기존 컨테이너 중지·삭제
docker stop api-gateway 2>/dev/null || true
docker rm api-gateway 2>/dev/null || true

# 최신 이미지 pull (latest 또는 특정 SHA 태그)
docker pull <DOCKER_USERNAME>/api.kroaddy.site:latest

# 환경 변수는 .env 파일 또는 -e 로 전달
docker run -d \
  --name api-gateway \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file /path/to/.env.api-gateway \
  <DOCKER_USERNAME>/api.kroaddy.site:latest
```

`.env.api-gateway` 는 EC2 로컬에 두고, DB/Redis/JWT/OAuth 등 필요한 값만 넣으면 됨. (GitHub Secrets 아님)

**자동화**: cron으로 주기적으로 `docker pull ... && docker stop ... && docker rm ... && docker run ...` 실행하면 됨.

---

## 2. 양식 요약 (체크리스트)

```
[ ] Docker Hub 레포 생성 (예: api.kroaddy.site)
[ ] Docker Hub Access Token → GitHub Secrets: DOCKER_USERNAME, DOCKER_PASSWORD
[ ] main push 또는 수동 Run workflow → Docker Hub에 이미지 push 확인
[ ] EC2에서 docker pull & docker run (수동 또는 cron)
[ ] EC2에서 curl http://localhost:8080/actuator/health 확인
```

---

## 3. 트러블슈팅

| 현상 | 확인 사항 |
|------|-----------|
| Docker Hub push 실패 | DOCKER_USERNAME, DOCKER_PASSWORD, 레포 이름/권한 |
| EC2에서 pull 실패 | Private 레포면 `docker login`, 이미지 이름/태그 일치 |
| 컨테이너 기동 실패 | EC2에서 `docker logs api-gateway`, env 파일 값 |
| Health 404/5xx | Spring 프로파일, actuator 설정 |

이 문서는 **api.kroaddy.site** 레포 기준이다. 레포 루트에 `build.gradle`, `gateway/Dockerfile` 이 있는 구조에서 `context: .`, `file: ./gateway/Dockerfile` 로 동작한다.
