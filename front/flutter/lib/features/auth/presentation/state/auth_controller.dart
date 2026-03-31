import "dart:convert";

import "package:app_links/app_links.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../../core/auth/service/auth_service.dart";
import "../../../../core/auth/token_store.dart";
import "../../../../core/network/api_client.dart";
import "../../data/auth_repository.dart";
import "auth_state.dart";

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

class AuthController extends Notifier<AuthState> {
  AuthRepository get _repo => ref.read(authRepositoryProvider);
  TokenStore get _tokenStore => ref.read(tokenStoreProvider);
  AuthService get _authService => ref.read(authServiceProvider);

  @override
  AuthState build() {
    Future.microtask(() async {
      // 콜드 스타트로 딥링크가 들어온 경우(특히 다른 기기/브라우저 조합에서 흔함)
      // signInWithProvider의 stream을 못 타도 여기서 initial link로 토큰 저장 가능
      await _tryConsumeInitialOAuthCallback();
      await _restoreSession();
    });
    return AuthState.initial();
  }

  Future<void> _tryConsumeInitialOAuthCallback() async {
    try {
      final appLinks = AppLinks();
      final uri = await appLinks.getInitialLink();
      if (uri == null) return;
      if (uri.scheme != "kroaddy" || uri.host != "auth") return;

      final error = uri.queryParameters["error"]?.trim();
      if (error != null && error.isNotEmpty) {
        state = state.copyWith(message: "OAuth 오류: $error");
        return;
      }
      final token = uri.queryParameters["token"]?.trim() ?? "";
      if (token.isEmpty) {
        state = state.copyWith(message: "OAuth 콜백에 token이 없습니다. (받은 URI: $uri)");
        return;
      }
      final refreshToken = uri.queryParameters["refresh_token"]?.trim();
      await _tokenStore.writeTokens(accessToken: token, refreshToken: refreshToken);
      state = state.copyWith(accessToken: token, message: "로그인 성공");
    } catch (_) {
      // ignore
    }
  }

  /// 앱 시작 시 세션 복원
  ///
  /// 1. Secure Storage에서 AT를 읽어 유효하면 네트워크 없이 즉시 진입
  ///    → 지하철/오지 등 열악한 환경에서도 앱 즉시 사용 가능
  /// 2. AT가 만료된 경우에만 RT로 갱신 시도 (네트워크 1회 호출)
  /// 3. RT도 없거나 갱신 실패 시 로그인 화면 유지
  Future<void> _restoreSession() async {
    final accessToken = await _tokenStore.readAccessToken();

    if (accessToken != null && accessToken.isNotEmpty) {
      if (!_isTokenExpired(accessToken)) {
        // 유효한 AT가 저장되어 있음 → 즉시 로그인 (네트워크 불필요)
        state = state.copyWith(
          accessToken: accessToken,
          message: "자동 로그인 성공",
        );
        return;
      }
    }

    // AT가 없거나 만료됨 → RT로 갱신 시도
    final refreshToken = await _tokenStore.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      await _tokenStore.clear();
      return;
    }

    try {
      final newToken = await _authService.refreshAccessToken();
      state = state.copyWith(
        accessToken: newToken,
        message: "토큰 갱신 후 자동 로그인 성공",
      );
    } catch (_) {
      // RT 만료 또는 서버 오류 → 저장 토큰 삭제, 로그인 화면 유지
      await _tokenStore.clear();
    }
  }

  Future<void> signIn(String provider) async {
    state = state.copyWith(loading: true, message: "$provider 로그인 진행 중...");
    try {
      final token = await _repo.signInWithProvider(provider);
      state = state.copyWith(
        loading: false,
        accessToken: token,
        message: "$provider 로그인 성공",
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        message: "$provider 로그인 실패: $e",
      );
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    state = state.copyWith(
      message: "로그아웃 완료",
      clearToken: true,
    );
  }

  /// JWT payload의 exp claim으로 로컬에서 만료 여부 확인
  /// 네트워크 없이도 AT 유효성을 판단하기 위해 사용
  bool _isTokenExpired(String token) {
    try {
      final parts = token.split(".");
      if (parts.length != 3) return true;
      final normalized = _base64UrlNormalize(parts[1]);
      final payload = String.fromCharCodes(base64Decode(normalized));
      final expMatch = RegExp(r'"exp"\s*:\s*(\d+)').firstMatch(payload);
      if (expMatch == null) return true;
      final exp = int.parse(expMatch.group(1)!);
      final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      return now >= exp;
    } catch (_) {
      return true;
    }
  }

  String _base64UrlNormalize(String s) {
    String result = s.replaceAll("-", "+").replaceAll("_", "/");
    switch (result.length % 4) {
      case 2:
        result += "==";
      case 3:
        result += "=";
    }
    return result;
  }
}
