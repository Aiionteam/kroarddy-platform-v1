import "dart:typed_data";

import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/network/api_client.dart";
import "planner_models.dart";

final plannerRepositoryProvider = Provider<PlannerRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return PlannerRepository(dio);
});

class PlannerRepository {
  PlannerRepository(this._dio);

  final Dio _dio;

  Never _throwApiError(DioException e, String fallback) {
    final status = e.response?.statusCode;
    if (status == 429 || status == 503) {
      final detail = e.response?.data is Map
          ? (e.response?.data["detail"]?.toString())
          : null;
      throw Exception("$status: ${detail ?? (status == 503 ? "AI 서버가 바쁩니다. 잠시 후 다시 시도해 주세요." : "AI 사용량이 초과됐습니다. 잠시 후 다시 시도해 주세요.")}");
    }
    throw Exception(fallback);
  }

  Future<RoutesResponse> fetchRoutes({
    required String location,
    String? startDate,
    String? endDate,
    int? userId,
    List<String>? existingRoutes,
    bool useSearch = false,
    List<Map<String, dynamic>>? newsTop10,
    String? transportMode,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        "/v1/planner/$location/routes",
        data: {
          "start_date": startDate,
          "end_date": endDate,
          "user_id": userId,
          "existing_routes": existingRoutes,
          "use_search": useSearch,
          "news_top10": newsTop10,
          if (transportMode != null) "transport_mode": transportMode,
        },
      );
      return RoutesResponse.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      _throwApiError(e, "루트 API 오류");
    }
  }

  Future<ScheduleResponse> fetchSchedule({
    required String location,
    required String routeName,
    String? startDate,
    String? endDate,
    int? userId,
    bool useSearch = false,
    List<Map<String, dynamic>>? newsTop10,
    String? transportMode,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        "/v1/planner/$location/schedule",
        data: {
          "route_name": routeName,
          "start_date": startDate,
          "end_date": endDate,
          "user_id": userId,
          "use_search": useSearch,
          "news_top10": newsTop10,
          if (transportMode != null) "transport_mode": transportMode,
        },
      );
      return ScheduleResponse.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      _throwApiError(e, "일정 API 오류");
    }
  }

  Future<SavePlanResponse> savePlan({
    required String location,
    required String routeName,
    required List<ScheduleItem> schedule,
    String? startDate,
    String? endDate,
    int? userId,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/planner/plans",
      data: {
        "location": location,
        "route_name": routeName,
        "start_date": startDate,
        "end_date": endDate,
        "schedule": schedule.map((e) => e.toJson()).toList(),
        "user_id": userId,
      },
    );
    return SavePlanResponse.fromJson(res.data ?? const {});
  }

  Future<List<TravelPlanRecord>> fetchMyPlans(int userId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/v1/planner/plans",
      queryParameters: {"user_id": userId},
    );
    final raw = (res.data?["plans"] as List?) ?? const [];
    return raw
        .whereType<Map>()
        .map((e) => TravelPlanRecord.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  /// 네이버 Static Map 이미지 bytes 반환 (백엔드 프록시)
  /// 네이버 Static Map 이미지 bytes 반환 (백엔드 프록시)
  /// 실패 시 에러 메시지를 담은 Exception을 throw합니다.
  Future<Uint8List> fetchStaticMapBytes({
    required double lat,
    required double lng,
    int w = 600,
    int h = 400,
    int zoom = 15,
  }) async {
    try {
      final res = await _dio.get<dynamic>(
        "/v1/maps/static-map",
        queryParameters: {"lat": lat, "lng": lng, "w": w, "h": h, "zoom": zoom},
        options: Options(responseType: ResponseType.bytes),
      );
      final data = res.data;
      if (data is List<int>) return Uint8List.fromList(data);
      if (data is Uint8List) return data;
      throw Exception("지도 이미지 데이터가 비어있습니다.");
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      final detail = e.response?.data is Map
          ? (e.response?.data["detail"]?.toString() ?? "")
          : "";
      throw Exception("지도 API 오류 (HTTP $status)${detail.isNotEmpty ? ": $detail" : ""}");
    } catch (e) {
      throw Exception("지도 로드 실패: $e");
    }
  }

  /// 장소명 → 좌표 (Naver 지역 검색 API 프록시)
  /// 실패 시 에러 메시지를 담은 Exception을 throw합니다.
  Future<Map<String, dynamic>> placeSearch(String query) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        "/v1/maps/place-search",
        queryParameters: {"query": query},
      );
      if (res.data == null) throw Exception("검색 결과 없음");
      return res.data!;
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      final detail = e.response?.data is Map
          ? (e.response?.data["detail"]?.toString() ?? "")
          : "";
      throw Exception("장소 검색 오류 (HTTP $status)${detail.isNotEmpty ? ": $detail" : ""}");
    } catch (e) {
      throw Exception("장소 검색 실패: $e");
    }
  }

  Future<void> deletePlan({required int planId, required int userId}) async {
    await _dio.delete<void>(
      "/v1/planner/plans/$planId",
      queryParameters: {"user_id": userId},
    );
  }

  Future<ModifyResponse> modifyPlan({
    required int planId,
    required int userId,
    required String instruction,
  }) async {
    try {
      final res = await _dio.patch<Map<String, dynamic>>(
        "/v1/planner/plans/$planId/modify",
        data: {
          "instruction": instruction,
          "user_id": userId,
        },
      );
      return ModifyResponse.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      _throwApiError(e, "일정 수정 API 오류");
    }
  }

  Future<RerollResponse> rerollPlanItem({
    required int planId,
    required int itemIndex,
    int? userId,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        "/v1/planner/plans/$planId/items/reroll",
        data: {
          "item_index": itemIndex,
          "user_id": userId,
        },
      );
      return RerollResponse.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      _throwApiError(e, "리롤 API 오류");
    }
  }
}
