import "dart:convert";
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

  /// Spring 게이트웨이 `read-timeout: 180s` 및 LLM 루트·일정 생성 시간에 맞춤.
  /// 웹 fetch API는 브라우저 기본으로 긴 대기가 가능해, 앱만 30초에서 끊기던 불일치를 맞춤.
  static const Duration _plannerAiReceiveTimeout = Duration(seconds: 180);

  static final Options _plannerAiOptions = Options(
    receiveTimeout: _plannerAiReceiveTimeout,
    sendTimeout: const Duration(seconds: 60),
  );

  Never _throwApiError(DioException e, String fallback) {
    final status = e.response?.statusCode;
    if (status == 429 || status == 503) {
      final detail = e.response?.data is Map
          ? (e.response?.data["detail"]?.toString())
          : null;
      throw Exception("$status: ${detail ?? (status == 503 ? "AI 서버가 바쁩니다. 잠시 후 다시 시도해 주세요." : "AI 사용량이 초과됐습니다. 잠시 후 다시 시도해 주세요.")}");
    }
    if (e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      throw Exception(
        "$fallback: 응답 시간이 초과되었습니다. AI 루트·일정 생성은 1~2분 걸릴 수 있습니다.",
      );
    }
    if (e.type == DioExceptionType.connectionTimeout) {
      throw Exception("$fallback: 연결 시간 초과");
    }
    final raw = e.response?.data;
    final detail = raw is Map ? (raw["detail"]?.toString() ?? "") : "";
    if (status != null) {
      throw Exception(
        "$fallback (HTTP $status)${detail.isNotEmpty ? ": $detail" : ""}",
      );
    }
    throw Exception("$fallback: ${e.message ?? e.toString()}");
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
          // 웹과 동일: 비어 있으면 필드 생략(백엔드가 null과 동일 처리)
          ...?((newsTop10?.isNotEmpty ?? false) ? {"news_top10": newsTop10} : null),
          ...?((transportMode != null) ? {"transport_mode": transportMode} : null),
        },
        options: _plannerAiOptions,
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
          ...?((newsTop10?.isNotEmpty ?? false) ? {"news_top10": newsTop10} : null),
          ...?((transportMode != null) ? {"transport_mode": transportMode} : null),
        },
        options: _plannerAiOptions,
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
      // ResponseType.bytes 일 때 에러 응답도 bytes로 수신 → JSON 디코딩 시도
      final detail = _extractDetail(e.response?.data);
      throw Exception("지도 API 오류 (HTTP $status)${detail.isNotEmpty ? ": $detail" : ""}");
    } catch (e) {
      throw Exception("지도 로드 실패: $e");
    }
  }

  /// DioException 응답 data에서 detail 문자열 추출
  /// ResponseType.bytes 사용 시 에러 응답이 `List<int>`로 옴
  static String _extractDetail(dynamic data) {
    try {
      if (data is Map) return data["detail"]?.toString() ?? "";
      if (data is List<int>) {
        final json = jsonDecode(utf8.decode(data)) as Map;
        return json["detail"]?.toString() ?? "";
      }
      if (data is String) {
        final json = jsonDecode(data) as Map;
        return json["detail"]?.toString() ?? "";
      }
    } catch (_) {}
    return "";
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

  /// 네이버 Directions 5 프록시 — 웹 `NaverRouteMapModal`의 `fetchCarRoute`와 동일 계약.
  /// 성공 시 `path`는 `[[lng, lat], ...]`. `fallback: true` 또는 경로 없으면 null.
  Future<DirectionsRouteDto?> fetchDirections({
    required double startLat,
    required double startLng,
    required double goalLat,
    required double goalLng,
    List<({double lat, double lng})> waypoints = const [],
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        "/v1/maps/directions",
        data: {
          "start": {"lng": startLng, "lat": startLat},
          "goal": {"lng": goalLng, "lat": goalLat},
          "waypoints": waypoints
              .map((w) => {"lng": w.lng, "lat": w.lat})
              .toList(),
        },
      );
      final data = res.data;
      if (data == null) return null;
      if (data["fallback"] == true) return null;
      final raw = data["path"];
      if (raw is! List || raw.length < 2) return null;

      final path = <(double lng, double lat)>[];
      for (final e in raw) {
        if (e is! List || e.length < 2) continue;
        path.add(((e[0] as num).toDouble(), (e[1] as num).toDouble()));
      }
      if (path.length < 2) return null;

      final summary = data["summary"];
      var distanceM = 0;
      var durationMs = 0;
      if (summary is Map) {
        distanceM = (summary["distance"] as num?)?.round() ?? 0;
        durationMs = (summary["duration"] as num?)?.round() ?? 0;
      }
      return DirectionsRouteDto(
        pathLngLat: path,
        distanceM: distanceM,
        durationMs: durationMs,
      );
    } on DioException {
      return null;
    } catch (_) {
      return null;
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
        options: _plannerAiOptions,
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
        options: _plannerAiOptions,
      );
      return RerollResponse.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      _throwApiError(e, "리롤 API 오류");
    }
  }
}

/// `/v1/maps/directions` 성공 본문 — 좌표 쌍은 항상 (경도, 위도).
class DirectionsRouteDto {
  const DirectionsRouteDto({
    required this.pathLngLat,
    this.distanceM = 0,
    this.durationMs = 0,
  });

  final List<(double lng, double lat)> pathLngLat;
  final int distanceM;
  final int durationMs;
}
