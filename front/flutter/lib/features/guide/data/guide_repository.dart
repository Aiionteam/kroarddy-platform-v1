import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:dio/dio.dart";

import "../../../core/network/api_client.dart";
import "guide_models.dart";

final guideRepositoryProvider = Provider<GuideRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return GuideRepository(dio);
});

class GuideRepository {
  GuideRepository(this._dio);

  final Dio _dio;

  Future<FestivalResponse> fetchFestivals({
    required int year,
    required int month,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/v1/festivals",
      queryParameters: {
        "year": year,
        "month": month,
      },
    );
    return FestivalResponse.fromJson(res.data ?? const {});
  }
}
