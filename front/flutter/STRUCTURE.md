# Kroaddy Flutter 앱 구조 (`front/flutter`)

## 개요

- **패키지 이름**: `kroaddy_app` (`pubspec.yaml`)
- **앱 진입점**: `lib/main.dart` → `ProviderScope`로 `KroaddyApp` 실행
- **아키텍처 방향**: 기능 단위(`features`) + 공용 레이어(`core`, `shared`)
- **상태 관리**: Riverpod (`flutter_riverpod`)
- **라우팅**: GoRouter (`go_router`)
- **HTTP**: Dio + 게이트웨이용 `AuthInterceptor` (`lib/core/network/`)

## 주요 의존성

| 패키지 | 용도 |
|--------|------|
| `flutter_riverpod` | 전역/피처 상태 |
| `go_router` | 선언적 라우팅, ShellRoute |
| `dio` | REST API |
| `flutter_secure_storage` | 액세스/리프레시 토큰 저장 |
| `app_links` | OAuth 딥링크 `kroaddy://auth` 수신 |
| `url_launcher` | 브라우저에서 OAuth 페이지 열기 |
| `image_picker`, `exif` | Tourstar 사진 선택·메타데이터 |
| `share_plus` | 공유 등 |

## 디렉터리 트리 (요약)

생성물·캐시는 문서에서 생략합니다. 실제로는 `build/`, `.dart_tool/` 등이 존재합니다.

```
front/flutter/
├── android/                 # Android 빌드·매니페스트·Gradle
├── ios/                     # iOS (프로젝트가 있으면 동일 패턴)
├── lib/                     # Dart 소스 (본 문서 핵심)
├── pubspec.yaml
├── analysis_options.yaml
└── key.properties           # (선택) 로컬 릴리즈 서명용 — Git에 올리지 않음
```

## `lib/` 레이어링

```
lib/
├── main.dart                 # runApp, ProviderScope
├── app.dart                  # MaterialApp.router + routerConfig
├── core/                     # 앱 전역 공용
│   ├── config/app_env.dart     # API_BASE_URL, WEB_BASE_URL (--dart-define)
│   ├── auth/                   # JWT 파싱, 토큰 저장, AuthService(갱신)
│   ├── network/                # dioProvider, rawDio, AuthInterceptor
│   ├── router/                 # GoRouter, MainShell, 뒤로가기 처리
│   └── utils/                  # 공유 링크 파서 등
├── features/                 # 도메인별 기능 (화면 + 상태 + 저장소)
│   ├── auth/
│   ├── home/
│   ├── tourstar/
│   ├── planner/
│   ├── guide/
│   ├── chat/
│   └── profile/
└── shared/                   # 여러 기능에서 쓰는 위젯
    └── widgets/
```

### `core/` 상세

| 경로 | 역할 |
|------|------|
| `core/config/app_env.dart` | 기본 `https://api.kroaddy.site/api`, 웹 베이스 URL |
| `core/auth/token_store.dart` | Secure Storage 읽기/쓰기 |
| `core/auth/jwt_claims.dart` | 토큰에서 userId, 닉네임 추출 |
| `core/auth/service/auth_service.dart` | 리프레시 토큰으로 AT 재발급 |
| `core/network/api_client.dart` | `dioProvider` (인터셉터 포함) |
| `core/network/auth_interceptor.dart` | Bearer 헤더, 401 시 갱신 재시도 |
| `core/router/app_router.dart` | `/login`, ShellRoute 하위 탭 라우트 |
| `core/router/main_shell.dart` | Drawer, 하단/탭 셸 레이아웃 |
| `core/router/shell_back_handler.dart` | 안드로이드 뒤로가기 시 `pop` 또는 계층적 `go` |

### `features/` 공통 패턴

각 기능은 보통 아래 중 일부를 가집니다.

- **`data/`**: API 호출, 모델(`*_models.dart`), `Repository`
- **`presentation/`**: `*_page.dart` 위젯
- **`presentation/state/`**: `*Controller`, `*State` (Riverpod `Notifier`)

## 기능별 디렉터리 (`lib/features`)

### `auth/`

- **`data/auth_repository.dart`**: `/google|kakao|naver/auth-url`, 브라우저 OAuth, `kroaddy://auth` 콜백에서 토큰 수신
- **`presentation/login_page.dart`**: 소셜 로그인 버튼
- **`presentation/state/auth_controller.dart`**: 로그인/세션 복원, 초기 딥링크 소비

### `home/`

- **`home_page.dart`**: 대시보드, 바로가기
- **`data/news_repository.dart`**, **`state/news_context.dart`**: 뉴스 관련

### `tourstar/`

- **`data/`**: Tourstar API, 모델 (`tourstar_repository.dart`, `tourstar_models.dart`)
- **`presentation/tourstar_page.dart`**: 피드·상세·생성 UI (대용량)
- **`presentation/state/`**: `tourstar_controller.dart`, `tourstar_state.dart`

### `planner/`

- **`data/`**: 플래너·K-콘텐츠·유저 콘텐츠 API/모델
- **`presentation/`**: `planner_page.dart`, `schedule_page.dart`, `k_content_package_page.dart`
- **`presentation/state/`**: `planner_controller`, `k_content_*`, `user_content_*`

### `guide/`

- **`data/`**: `guide_repository.dart`, `guide_models.dart`
- **`presentation/`**: 랜딩, 이벤트, 맛집, `guide_page` 등
- **`presentation/state/`**: `guide_controller`, `guide_state`

### `chat/`

- **`data/friend_repository.dart`**
- **`presentation/`**: `chat_page`, `friends_page`, `whisper_page`

### `profile/`

- **`data/`**: 프로필 API·모델
- **`presentation/`**: `profile_page`, `onboarding_page`
- **`presentation/state/`**: `profile_controller`, `profile_state`

## `shared/`

- **`widgets/feature_placeholder_page.dart`**: 미구현 기능용 플레이스홀더 등

## 라우팅 흐름 (개념)

1. `appRouterProvider`가 `GoRouter` 생성, `initialLocation: /login`
2. 로그인 성공 시 `accessToken` 변경을 `ref.listen`으로 감지해 **`/home`으로 이동**
3. **`ShellRoute`**: `MainShell` + 자식 라우트(`/home`, `/tourstar`, `/planner`, …)
4. 로그인·셸에 **`PopScope`**를 두어 Android 시스템 뒤로가기 동작 제어

## 네트워크

- 대부분의 API는 **`AppEnv.apiBaseUrl`** (`https://api.kroaddy.site/api`) 경유
- Tourstar 등 일부는 **전용 Base URL**로 직접 호출할 수 있음 (`tourstar_repository.dart` 등에서 확인)

## 네이티브 (`android/`)

- **`app/src/main/AndroidManifest.xml`**: `INTERNET`, `kroaddy` / `auth` VIEW intent-filter (OAuth 콜백)
- **`app/build.gradle.kts`**: 앱 ID, `key.properties`가 있을 때 release 서명 설정

## 빌드 산출물 (참고)

- Debug APK: `build/app/outputs/flutter-apk/app-debug.apk`
- Release APK: `build/app/outputs/flutter-apk/app-release.apk`
- App Bundle: `build/app/outputs/bundle/release/app-release.aab`

`build/`는 `.gitignore` 대상이 일반적입니다.

---

*문서는 저장소 스냅샷 기준이며, 파일 추가/이동 시 트리를 갱신해 두는 것이 좋습니다.*
