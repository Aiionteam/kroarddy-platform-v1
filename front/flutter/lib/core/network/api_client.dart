import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_secure_storage/flutter_secure_storage.dart";

import "../auth/service/auth_service.dart";
import "../auth/token_store.dart";
import "../config/app_env.dart";
import "auth_interceptor.dart";

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});

final tokenStoreProvider = Provider<TokenStore>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return TokenStore(storage);
});

final rawDioProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      baseUrl: AppEnv.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 30),
      headers: const {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    ),
  );
});

final authServiceProvider = Provider<AuthService>((ref) {
  final rawDio = ref.watch(rawDioProvider);
  final tokenStore = ref.watch(tokenStoreProvider);
  return AuthService(rawDio, tokenStore);
});

final dioProvider = Provider<Dio>((ref) {
  final tokenStore = ref.watch(tokenStoreProvider);
  final authService = ref.watch(authServiceProvider);
  final dio = Dio(
    BaseOptions(
      baseUrl: AppEnv.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 30),
      headers: const {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    ),
  );
  dio.interceptors.add(AuthInterceptor(dio, tokenStore, authService));
  return dio;
});
