# Vercel 배포 가이드

## 백엔드 없이 올리기 (프론트만 먼저 배포)

- **환경 변수 설정하지 않아도 됩니다.** 그대로 배포하면 됩니다.
- 페이지/빌드는 정상 동작하고, 로그인·플래너 등 **API를 쓰는 기능만** "백엔드가 연결되지 않았습니다" 메시지와 함께 실패합니다.
- 나중에 백엔드(gateway) URL이 생기면 아래 환경 변수만 추가하고 재배포하면 됩니다.

## NOT_FOUND(404) 나올 때

Vercel의 NOT_FOUND는 **“요청한 리소스를 찾을 수 없다”**는 뜻입니다. 다음 두 가지를 구분해서 보세요.

| 원인 | 확인할 것 |
|------|------------|
| **배포/URL 쪽** | 배포 URL 오타, 삭제된 배포, 잘못된 프로젝트/팀 권한 |
| **앱 라우트 쪽** | 존재하지 않는 경로 접근 (예: `/random-path`) → `app/not-found.tsx` 로 404 페이지 표시됨 |

**체크 순서**

1. **배포 URL** – Vercel 대시보드의 배포 URL과 브라우저 주소창이 일치하는지 확인
2. **배포 존재 여부** – 해당 배포가 삭제되지 않았는지 확인
3. **배포 로그** – 빌드/런타임 에러가 없는지 [Deployment Logs](https://vercel.com/docs/deployments/logs)에서 확인
4. **접근 경로** – 루트(`/`) 또는 실제 있는 경로(`/home`, `/planner` 등)로 접속했는지 확인

백엔드 없이 올릴 때는 **환경 변수 없이** 배포해도 NOT_FOUND 원인은 되지 않습니다. 위 항목만 확인하면 됩니다.

## 나중에 백엔드 연결할 때

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `NEXT_PUBLIC_API_URL` | 백엔드 게이트웨이 URL (프로토콜 포함) | `https://api.example.com` |

**Settings → Environment Variables** 에 추가한 뒤 **Redeploy** 하세요.

## CORS

게이트웨이(Spring Boot)에서 Vercel 도메인(`https://*.vercel.app`)을 `Access-Control-Allow-Origin` 에 허용해야 합니다.
