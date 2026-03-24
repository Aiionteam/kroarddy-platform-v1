import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/network/api_client.dart";

final newsRepositoryProvider = Provider<NewsRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return NewsRepository(dio);
});

class NewsRepository {
  NewsRepository(this._dio);

  final Dio _dio;

  Future<List<Map<String, dynamic>>> fetchProcessedTop10({int limitRest = 0}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/v1/news/processed",
      queryParameters: {"limit_rest": limitRest},
      options: Options(receiveTimeout: const Duration(seconds: 30)),
    );
    final rawTop10 = (res.data?["top10"] as List?) ?? const [];
    return rawTop10
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}

