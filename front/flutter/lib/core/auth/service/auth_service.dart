import "package:dio/dio.dart";

import "../token_store.dart";

class AuthService {
  AuthService(this._rawDio, this._tokenStore);

  final Dio _rawDio;
  final TokenStore _tokenStore;

  Future<String> refreshAccessToken() async {
    final refreshToken = await _tokenStore.readRefreshToken();

    final response = await _rawDio.post<Map<String, dynamic>>(
      "/auth/refresh",
      data: refreshToken == null || refreshToken.isEmpty
          ? null
          : {"refresh_token": refreshToken},
    );

    final body = response.data ?? const <String, dynamic>{};
    final accessToken = body["access_token"]?.toString().trim() ?? "";
    if (accessToken.isEmpty) {
      throw Exception("리프레시 응답에 access_token이 없습니다.");
    }

    final newRefreshToken = body["refresh_token"]?.toString().trim();
    await _tokenStore.writeTokens(
      accessToken: accessToken,
      refreshToken: newRefreshToken,
    );
    return accessToken;
  }
}
