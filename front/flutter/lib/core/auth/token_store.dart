import "package:flutter_secure_storage/flutter_secure_storage.dart";

/// Access Token과 Refresh Token 모두 OS 보안 저장소에 보관합니다.
///
/// 여행 앱 특성상 열악한 네트워크 환경에서도 유효한 AT가 있으면
/// 서버 호출 없이 즉시 앱 진입이 가능해야 하므로, AT도 영속 저장합니다.
/// 쿠키 기반 인증은 사용하지 않습니다.
class TokenStore {
  TokenStore(this._storage);

  static const _accessTokenKey = "access_token";
  static const _refreshTokenKey = "refresh_token";

  final FlutterSecureStorage _storage;

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);

  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  Future<void> writeTokens({
    required String accessToken,
    String? refreshToken,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await _storage.write(key: _refreshTokenKey, value: refreshToken);
    }
  }

  Future<void> clear() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }
}
