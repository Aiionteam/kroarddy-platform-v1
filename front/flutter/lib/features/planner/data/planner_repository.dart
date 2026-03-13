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

  Future<RoutesResponse> fetchRoutes({
    required String location,
    String? startDate,
    String? endDate,
    int? userId,
    List<String>? existingRoutes,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/planner/$location/routes",
      data: {
        "start_date": startDate,
        "end_date": endDate,
        "user_id": userId,
        "existing_routes": existingRoutes,
      },
    );
    return RoutesResponse.fromJson(res.data ?? const {});
  }

  Future<ScheduleResponse> fetchSchedule({
    required String location,
    required String routeName,
    String? startDate,
    String? endDate,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/planner/$location/schedule",
      data: {
        "route_name": routeName,
        "start_date": startDate,
        "end_date": endDate,
      },
    );
    return ScheduleResponse.fromJson(res.data ?? const {});
  }
}
