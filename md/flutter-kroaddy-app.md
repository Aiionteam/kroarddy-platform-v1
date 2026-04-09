# Kroaddy Flutter 앱 (`front/flutter`) — 기술 개요

## 1. 개요

Kroaddy Flutter 앱은 **Next.js 웹(`web.kroaddy.site`)과 동일한 백엔드**(`https://api.kroaddy.site`)를 바라보는 모바일 클라이언트입니다. 인증·유저·그룹채팅·다이어리 등은 Spring MVC API를, 가이드·플래너·뉴스·프로필·사진선별(Tourstar) 게이트 경로는 FastAPI 프록시를 통해 호출합니다. 일부 정적·BFF 성격 API는 **웹 베이스 URL**(`https://web.kroaddy.site`)로 직접 요청하고, Tourstar 전용 업로드 등은 **별도 호스트**(`https://tourstar.kroaddy.site`)를 사용합니다.

상위 시스템 구성은 `md/kroaddy-project-technical-spec.md`를 기준으로 합니다.

## 2. 기술 스택

| 구분 | 선택 |
|------|------|
| 프레임워크 | Flutter (Dart SDK ^3.11.1) |
| 상태 관리 | flutter_riverpod |
| 라우팅 | go_router |
| HTTP | dio |
| 인증 저장 | flutter_secure_storage |
| 미디어 | image_picker, exif |
| 공유·링크 | share_plus, url_launcher, app_links |
| 지도 | flutter_naver_map, geolocator |
| UI·콘텐츠 | flutter_markdown, google_fonts |

## 3. 디렉터리 구조 (요약)

```
front/flutter/lib/
  main.dart                 # Naver Map SDK 초기화(선택), ProviderScope
  app.dart                  # MaterialApp.router, 테마
  core/
    config/app_env.dart     # API_BASE_URL, WEB_BASE_URL (--dart-define)
    network/                # Dio, AuthInterceptor
    auth/                   # TokenStore, JWT 파싱, refresh, AuthService
    router/                 # GoRouter, MainShell, 뒤로가기 처리
    theme/, widgets/
  features/
    auth/                   # 로그인, OAuth 딥링크
    home/                   # 뉴스 배너, 바로가기, K-테마
    guide/                  # 장소탐색, 네이버맵, AI 가이드
    planner/                # 여행지·AI 루트/일정·K-콘텐츠·마이플랜
    tourstar/               # 여행피드, 사진 업로드·게시글
    chat/                   # 그룹톡, 개인톡(Whisper), 친구
    profile/                # 설정, 온보딩, 프로필·여행 프로필
  shared/widgets/
```

기능별 상세는 다음 문서를 참고합니다.

| 문서 | 내용 |
|------|------|
| `md/flutter-kroaddy-auth.md` | 인증·토큰·로그인 |
| `md/flutter-kroaddy-home.md` | 홈·뉴스 |
| `md/flutter-kroaddy-guide.md` | 장소탐색 |
| `md/flutter-kroaddy-planner.md` | 플래너·K-콘텐츠·유저 컨텐츠·마이플랜 |
| `md/flutter-kroaddy-tourstar.md` | 여행피드 |
| `md/flutter-kroaddy-chat.md` | 그룹톡·개인톡·친구 |
| `md/flutter-kroaddy-profile.md` | 프로필·온보딩 |

## 4. 환경 변수 (`--dart-define`)

`lib/core/config/app_env.dart` 기준:

| 키 | 기본값 | 설명 |
|----|--------|------|
| `API_BASE_URL` | `https://api.kroaddy.site/api` | Dio 기본 베이스 (대부분의 REST) |
| `WEB_BASE_URL` | `https://web.kroaddy.site` | Next API·정적 이미지 등 |
| `NAVER_MAP_DYNAMIC_MAP_CLIENT_ID` | (빈 문자열) | 네이버 모바일 지도 SDK (Dynamic Map) |

로컬 게이트웨이 예: `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8080/api`

## 5. 네트워크 계층

- **`rawDioProvider`**: 인터셉터 없음. OAuth URL 조회, 뉴스(비인증 가능 경로) 등에 사용.
- **`dioProvider`**: `AuthInterceptor` 부착. Access Token 헤더 부여, 401 시 `AuthService.refreshAccessToken()`으로 갱신 후 재시도.

타임아웃 기본: connect 10s, receive/send 30s. **AI 플래너** 호출은 `PlannerRepository`에서 receive **180초**로 연장(게이트웨이 read-timeout과 정합).

## 6. 라우팅 (`go_router`)

| 경로 | 화면 |
|------|------|
| `/login` | LoginPage |
| `/home` | HomePage |
| `/guide` | GuideExplorePage |
| `/tourstar`, `/tourstar/post/:postId` | TourstarPage (딥링크 query `postId` 지원) |
| `/planner` | PlannerPage |
| `/planner/k-content` | PlannerPage (K-콘텐츠 탭) |
| `/planner/k-content/:packageId` | KContentPackagePage |
| `/planner/schedule` | SchedulePage (마이플랜) |
| `/chat` | ChatPage (그룹톡) |
| `/chat/friends` | FriendsPage |
| `/chat/whisper` | WhisperPage |
| `/profile` | ProfilePage |
| `/profile/onboarding` | OnboardingPage |

로그인 성공 시 `authControllerProvider`의 accessToken 변경을 `ref.listen`하여 `/home`으로 이동합니다. 메인 영역은 `MainShell` + Drawer(`main_shell.dart`)로 네비게이션을 통일합니다.

## 7. 백엔드 연동 요약

**베이스: `API_BASE_URL` (예: `.../api`)**

- **Spring MVC (같은 호스트 `/api` 하위)**: `/kakao|naver|google/auth-url`, `/auth/refresh`, `/users`, `/friends`, `/groupchat`, `/whisper` 등
- **게이트웨이 프록시 (FastAPI)**: `/v1/news`, `/v1/guide`, `/v1/planner`, `/v1/k-content`, `/v1/user-content`, `/v1/maps`, `/v1/photo-selection` 등

**별도 호스트**

- `https://tourstar.kroaddy.site`: 프로필 이미지 업로드 등 Tourstar 전용 Dio 인스턴스 (`TourstarRepository` 내 `_tourstarDio`)

**웹 베이스**

- `WEB_BASE_URL/api/k-content/images/...`: K-콘텐츠 배너·패키지 이미지 목록

## 8. 클라이언트 아키텍처 도식

고정폭 글꼴에서 정렬을 맞추었습니다.

```
+------------------+     +------------------+
| web.kroaddy.site |     | Flutter app      |
| (Next.js)        |     | front/flutter    |
+--------+---------+     +--------+---------+
         |                          |
         |    https://api.kroaddy.site/api
         +-------------+--------------+
                       |
                       v
         +-----------------------------+
         | Spring MVC + Gateway proxy  |
         +-----------------------------+
                       |
      +----------------+----------------+
      |                |                |
  /users,           /v1/planner,    /v1/guide,
  /groupchat,       /v1/news,       /v1/photo-selection,
  /whisper, ...     /v1/user-profile, ...
```

```
Flutter (일부 흐름)

  WEB_BASE_URL  -------->  Next API (k-content images 등)
  tourstar.kroaddy.site ->  Tourstar 전용 업로드/처리
  Naver Map SDK           ->  장소탐색 지도 (클라이언트)
  NCP Maps API            ->  백엔드 /v1/maps 프록시 경유 (플래너 일정 지도)
```

## 9. 빌드·실행

- 패키지: `front/flutter`에서 `flutter pub get`
- Android 패키지명(네이버 지도): `site.kroaddy.kroaddy_app` (로그 힌트 기준)
- 릴리스 빌드 시 네이버 지도 Client ID를 `--dart-define=NAVER_MAP_DYNAMIC_MAP_CLIENT_ID=...` 로 주입

## 10. 참고

- 백엔드 라우트: `md/api-kroaddy-site.md`, 플래너: `md/planer-kroaddy-site.md`, 프로필 서비스: `md/profile-kroaddy-site.md`
- 본 문서는 `front/flutter/lib` 소스와 `pubspec.yaml`을 근거로 정리했습니다.
