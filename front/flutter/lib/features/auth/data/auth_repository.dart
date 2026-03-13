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

    // 외부 브라우저로 OAuth URL 열기
    final uri = Uri.parse(authUrl);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      throw Exception("브라우저를 열 수 없습니다.");
    }

    // 딥링크 수신 대기 (kroaddy://auth/login/callback?token=...)
    final appLinks = AppLinks();
    final callbackUri = await appLinks.uriLinkStream
        .where((u) => u.scheme == "kroaddy" && u.host == "auth")
        .first
        .timeout(
          const Duration(minutes: 5),
          onTimeout: () => throw Exception("로그인 시간이 초과됐습니다."),
        );

    final error = callbackUri.queryParameters["error"]?.trim();
    if (error != null && error.isNotEmpty) {
      throw Exception("OAuth 오류: $error");
    }
    final token = callbackUri.queryParameters["token"]?.trim() ?? "";
    if (token.isEmpty) throw Exception("OAuth 콜백에 token이 없습니다.");

    await _tokenStore.writeTokens(accessToken: token);
    return token;
  }

  Future<void> logout() async {
    await _tokenStore.clear();
  }
}
