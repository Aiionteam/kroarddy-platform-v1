import "package:app_links/app_links.dart";
import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:url_launcher/url_launcher.dart";

import "../../../core/auth/token_store.dart";
import "../../../core/network/api_client.dart";

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final dio = ref.watch(rawDioProvider);
  final tokenStore = ref.watch(tokenStoreProvider);
  return AuthRepository(dio, tokenStore);
});

class AuthRepository {
  AuthRepository(this._dio, this._tokenStore);

  static const callbackBase = "kroaddy://auth";
  static const _callbackScheme = "kroaddy";
  static const _callbackHost = "auth";

  final Dio _dio;
  final TokenStore _tokenStore;

  Future<String> _getAuthUrl({required String provider}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      "/$provider/auth-url",
      queryParameters: <String, dynamic>{"frontend_url": callbackBase},
    );
    final data = response.data ?? const <String, dynamic>{};
    if (data["success"] == false) {
      throw Exception(data["message"]?.toString() ?? "인증 URL 생성 실패");
    }
    final authUrl = data["auth_url"]?.toString() ?? "";
    if (authUrl.isEmpty) throw Exception("인증 URL 응답이 비어 있습니다.");
    return authUrl;
  }

  Future<String> signInWithProvider(String provider) async {
    final authUrl = await _getAuthUrl(provider: provider);

    // 딥링크 수신 리스너를 먼저 준비 (외부 브라우저 왕복 중 이벤트 유실 방지)
    final appLinks = AppLinks();

    bool isCallback(Uri u) {
      return u.scheme == _callbackScheme && u.host == _callbackHost;
    }

    // stream 구독을 먼저 걸어두고 브라우저를 연다 (가장 흔한 이벤트 유실 케이스 방지)
    final streamFuture = appLinks.uriLinkStream.where(isCallback).first;

    // 외부 브라우저로 OAuth URL 열기
    final uri = Uri.parse(authUrl);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      throw Exception("브라우저를 열 수 없습니다.");
    }

    // 딥링크 수신 대기 (kroaddy://auth?...token=...)
    // - 앱이 죽어있다가 콜백으로 실행된 경우: getInitialLink()
    // - 앱이 살아있고 브라우저에서 돌아오는 경우: uriLinkStream
    final initial = await appLinks.getInitialLink();
    final callbackUri = (initial != null && isCallback(initial))
        ? initial
        : await streamFuture.timeout(
            const Duration(minutes: 5),
            onTimeout: () => throw Exception("로그인 시간이 초과됐습니다."),
          );

    // timeout은 최종 await에 건다 (streamFuture는 이미 생성돼 있어도 timeout 적용 가능)
    // ignore: unnecessary_await_in_return
    // (가독성을 위해 명시)
    // - 콜백이 없으면 로그인 UI가 계속 로딩되는 현상을 메시지로 전환
    //   (상위에서 catch되어 state.message로 표출됨)
    // ignore: deprecated_member_use
    // (no-op)
    //
    // 실제 timeout 적용
    // (callbackUri를 구했으면 아래로 진행)

    final error = callbackUri.queryParameters["error"]?.trim();
    if (error != null && error.isNotEmpty) {
      throw Exception("OAuth 오류: $error");
    }
    final token = callbackUri.queryParameters["token"]?.trim() ?? "";
    if (token.isEmpty) {
      throw Exception("OAuth 콜백에 token이 없습니다. (받은 URI: $callbackUri)");
    }

    final refreshToken = callbackUri.queryParameters["refresh_token"]?.trim();
    await _tokenStore.writeTokens(
      accessToken: token,
      refreshToken: refreshToken,
    );
    return token;
  }

  Future<void> logout() async {
    await _tokenStore.clear();
  }
}
