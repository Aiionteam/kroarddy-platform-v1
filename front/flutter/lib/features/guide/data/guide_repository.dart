import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/network/api_client.dart";
import "guide_answer_sanitize.dart";
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

  Future<GuideAskResponse> postGuideAsk({
    required String question,
    Map<String, dynamic>? context,
  }) async {
    try {
      final body = <String, dynamic>{"question": question};
      if (context != null) {
        body["context"] = context;
      }
      final res = await _dio.post<Map<String, dynamic>>(
        "/v1/guide/ask",
        data: body,
        options: Options(
          receiveTimeout: const Duration(seconds: 120),
          sendTimeout: const Duration(seconds: 120),
        ),
      );
      final raw = GuideAskResponse.fromJson(res.data ?? const {});
      return GuideAskResponse(
        answer: sanitizeGuideAnswerForDisplay(raw.answer),
        source: raw.source,
        places: raw.places,
      );
    } on DioException catch (e) {
      throw Exception(_formatDioError(e));
    }
  }

  Future<GuideDirectionsResponse> postGuideDirections({
    required double startLat,
    required double startLng,
    required double goalLat,
    required double goalLng,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        "/v1/guide/directions",
        data: {
          "start_lat": startLat,
          "start_lng": startLng,
          "goal_lat": goalLat,
          "goal_lng": goalLng,
        },
        options: Options(
          receiveTimeout: const Duration(seconds: 45),
          sendTimeout: const Duration(seconds: 30),
        ),
      );
      return GuideDirectionsResponse.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      return GuideDirectionsResponse(
        ok: false,
        path: const [],
        distanceM: 0,
        durationMs: 0,
        tollFare: 0,
        fuelPrice: 0,
        message: "경로 API 오류 (${e.response?.statusCode ?? '—'})",
      );
    }
  }

  Future<GuidePlaceDetailsResponse> fetchPlaceDetails(String name) async {
    final q = name.trim();
    if (q.isEmpty) return GuidePlaceDetailsResponse.empty();
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        "/v1/guide/place/details",
        queryParameters: {"name": q},
      );
      return GuidePlaceDetailsResponse.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw Exception(_formatDioError(e));
    }
  }

  Future<GuideNearbyPlacesResponse> fetchNearbyPlaces({
    required double x,
    required double y,
    required String name,
    String category = "all",
  }) async {
    final n = name.trim();
    if (n.isEmpty || !x.isFinite || !y.isFinite) {
      return GuideNearbyPlacesResponse(items: const []);
    }
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        "/v1/guide/place/nearby",
        queryParameters: {
          "x": x,
          "y": y,
          "name": n,
          "category": category,
        },
      );
      return GuideNearbyPlacesResponse.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw Exception(_formatDioError(e));
    }
  }

  static String _formatDioError(DioException e) {
    final data = e.response?.data;
    if (data is Map) {
      final d = data["detail"];
      if (d != null) return d.toString();
      final m = data["message"];
      if (m != null) return m.toString();
    }
    final hint = e.response?.statusCode == 403
        ? "\n403 Forbidden — 로그인·토큰·CORS·권한을 확인하세요."
        : e.response?.statusCode == 401
            ? "\n401 Unauthorized — 로그인·토큰 갱신을 확인하세요."
            : "";
    final base = e.message ?? e.toString();
    return "$base$hint".trim();
  }
}
