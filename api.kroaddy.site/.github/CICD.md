# CI/CD 파이프라인 (GitHub Actions → Docker Hub → EC2)

- **트리거**: `main` 브랜치 push (gateway/ 또는 빌드 관련 파일 변경 시) 또는 수동 실행
- **흐름**: 빌드 → Docker 이미지 푸시 (Docker Hub) → EC2 SSH 배포
- **API 포트**: **8080**

## 1. GitHub Repository Secrets 설정

**Settings → Secrets and variables → Actions** 에서 다음 시크릿 추가:

| Secret 이름 | 설명 |
|------------|------|
| `DOCKERHUB_USERNAME` | Docker Hub 아이디 |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token (Settings → Security → New Access Token) |
| `EC2_HOST` | EC2 퍼블릭 IP 또는 도메인 (예: `3.35.xxx.xxx`) |
| `EC2_USER` | EC2 SSH 사용자 (Amazon Linux: `ec2-user`, Ubuntu: `ubuntu`) |
| `EC2_SSH_KEY` | EC2 접속용 프라이빗 키 전체 내용 (PEM) |

애플리케이션 환경 변수 (EC2 컨테이너에 주입):

| Secret 이름 | 설명 |
|------------|------|
| `NEON_CONNECTION_STRING` | DB URL |
| `NEON_USER` / `NEON_PASSWORD` | DB 계정 |
| `UPSTASH_REDIS_HOST` / `UPSTASH_REDIS_PORT` / `UPSTASH_REDIS_PASSWORD` | Redis |
| `JWT_SECRET` | JWT 서명 키 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Google OAuth |
| `NAVER_*` / `KAKAO_*` | 네이버/카카오 OAuth (사용 시) |
| `AI_SERVICE_RAG_URL` / `AI_SERVICE_VISION_URL` | AI 서비스 URL (사용 시) |

## 2. EC2 준비

1. **보안 그룹**: 인바운드 **22**(SSH), **8080**(API) 허용
2. **SSH 키**: 인스턴스 생성 시 사용한 키 쌍의 **프라이빗 키** 전체를 `EC2_SSH_KEY` 에 넣음
3. **Docker**: 워크플로가 EC2에 Docker가 없으면 `docker.io` 설치 후 컨테이너 실행

## 3. Docker Hub

1. [Docker Hub](https://hub.docker.com) 로그인 → **Repositories** → **Create Repository**
2. 이름 예: `api.tourstory.site` (이미지: `{DOCKERHUB_USERNAME}/api.tourstory.site`)
3. **Account Settings → Security → New Access Token** 으로 토큰 생성 후 `DOCKERHUB_TOKEN` 에 저장

## 4. 수동 배포

**Actions** 탭 → **Deploy API (api.tourstory.site) to EC2** → **Run workflow**

## 5. 배포 후 확인

- EC2에서: `curl http://localhost:8080/actuator/health`
- 외부에서: `http://{EC2_HOST}:8080/actuator/health` (보안 그룹 8080 허용 시)
