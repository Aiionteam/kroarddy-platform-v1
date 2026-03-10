# TourStory × api.tourstory.site 연결

**연동 구조**: 이 프로젝트(www.tourstory.site)는 **api.tourstory.site**와 연결합니다.  
www.hohyun.site는 참고용으로만 두며, API/백엔드와의 연동 대상에서는 제외합니다.

## 환경 변수

- **`NEXT_PUBLIC_API_URL`**: API 서버 주소
  - **로컬 개발**: 기본값 `http://localhost:8080` (미설정 시 코드 기본값)
  - **CI/CD 배포 시**: 빌드 환경 변수로 `https://api.tourstory.site` 설정
  - `.env.local`에 넣거나 `.env.local.example` 복사 후 필요 시 수정

## OAuth (구글/카카오/네이버)

- 로그인 시 **현재 사이트 주소**가 `frontend_url`로 api.tourstory.site에 전달됩니다.
- api.tourstory.site 쪽에서 **OAuth 리다이렉트 URI**에 TourStory 도메인을 등록해야 합니다.
  - 예: `https://www.tourstory.site/login/callback` (실서비스)
  - 로컬: `http://localhost:3000/login/callback`
- 구글/카카오/네이버 개발자 콘솔에서도 해당 리다이렉트 URI를 허용 목록에 추가해야 합니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 후 로그인 화면에서 구글/카카오/네이버 또는 게스트로 접속할 수 있습니다.
