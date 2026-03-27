import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/network/api_client.dart";

// 뉴스 서비스 – API 게이트웨이 경유 (application.yaml에 /api/v1/news/** 라우트 설정됨)
// baseUrl = "https://api.kroaddy.site/api", path = "/v1/news/processed"
// → 최종 URL: https://api.kroaddy.site/api/v1/news/processed
final newsRepositoryProvider = Provider<NewsRepository>((ref) {
  final dio = ref.watch(rawDioProvider);
  return NewsRepository(dio);
});

class NewsRepository {
  NewsRepository(this._dio);

  final Dio _dio;

  Future<List<Map<String, dynamic>>> fetchProcessedTop10({int limitRest = 0}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/v1/news/processed",
      queryParameters: {"limit_rest": limitRest},
    );
    final rawTop10 = (res.data?["top10"] as List?) ?? const [];
    return rawTop10
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}
