import "package:dio/dio.dart";

import "../auth/service/auth_service.dart";
import "../auth/token_store.dart";

class AuthInterceptor extends Interceptor {
  AuthInterceptor(
    this._dio,
    this._tokenStore,
    this._authService,
  );

  final Dio _dio;
  final TokenStore _tokenStore;
  final AuthService _authService;
  Future<String>? _refreshing;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final accessToken = await _tokenStore.readAccessToken();
    if (accessToken != null && accessToken.isNotEmpty) {
      options.headers["Authorization"] = "Bearer $accessToken";
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final statusCode = err.response?.statusCode;
    final request = err.requestOptions;
    final isRefreshCall = request.path.contains("/auth/refresh");
    final alreadyRetried = request.extra["retried"] == true;

    if (statusCode != 401 || isRefreshCall || alreadyRetried) {
      handler.next(err);
      return;
    }

    try {
      final token = await _refreshAccessTokenSafe();
      final retryOptions = request.copyWith(
        headers: <String, dynamic>{
          ...request.headers,
          if (token != null && token.isNotEmpty) "Authorization": "Bearer $token",
        },
      );
      retryOptions.extra["retried"] = true;

      final retryResponse = await _dio.fetch<dynamic>(retryOptions);
      handler.resolve(retryResponse);
    } catch (_) {
      await _tokenStore.clear();
      handler.next(err);
    }
  }

  Future<String?> _refreshAccessTokenSafe() async {
    if (_refreshing != null) return _refreshing;
    final future = _authService.refreshAccessToken();
    _refreshing = future;
    try {
      return await future;
    } finally {
      _refreshing = null;
    }
  }
}
