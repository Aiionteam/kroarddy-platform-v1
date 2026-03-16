import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/network/api_client.dart";

final kContentRepositoryProvider = Provider<KContentRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return KContentRepository(dio);
});

class KContentRepository {
  KContentRepository(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> health() async {
    final res = await _dio.get<Map<String, dynamic>>("/v1/k-content/health");
    return res.data ?? const <String, dynamic>{};
  }
}
