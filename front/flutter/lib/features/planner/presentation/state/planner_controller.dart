import "package:easy_localization/easy_localization.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../../core/auth/jwt_claims.dart";
import "../../../auth/presentation/state/auth_controller.dart";
import "../../../home/state/news_context.dart";
import "../../data/planner_repository.dart";
import "planner_state.dart";

final plannerControllerProvider = NotifierProvider<PlannerController, PlannerState>(
  PlannerController.new,
);

class PlannerController extends Notifier<PlannerState> {
  PlannerRepository get _repo => ref.read(plannerRepositoryProvider);

  @override
  PlannerState build() {
    final now = DateTime.now();
    final start = _fmt(now);
    final end = _fmt(now);
    return PlannerState.initial().copyWith(startDate: start, endDate: end);
  }

  String _fmt(DateTime d) {
    final m = d.month.toString().padLeft(2, "0");
    final day = d.day.toString().padLeft(2, "0");
    return "${d.year}-$m-$day";
  }

  void setLocation(String value) {
    state = state.copyWith(
      location: value.trim().toLowerCase(),
      routes: const [],
      schedule: const [],
      routesTriggered: false,
      clearSelectedRoute: true,
      clearSavedPlanId: true,
      clearCostSummary: true,
      clearRoutesError: true,
      clearScheduleError: true,
    );
  }

  void setUseSearch(bool value) {
    state = state.copyWith(
      useSearch: value,
      routes: const [],
      schedule: const [],
      routesTriggered: false,
      clearSelectedRoute: true,
      clearSavedPlanId: true,
      clearCostSummary: true,
      clearRoutesError: true,
      clearScheduleError: true,
    );
  }

  void setTransportMode(String mode) {
    state = state.copyWith(
      transportMode: mode,
      routes: const [],
      schedule: const [],
      routesTriggered: false,
      clearSelectedRoute: true,
      clearSavedPlanId: true,
      clearCostSummary: true,
      clearRoutesError: true,
      clearScheduleError: true,
    );
  }

  void setDateRange({required String startDate, required String endDate}) {
    state = state.copyWith(
      startDate: startDate,
      endDate: endDate,
      routes: const [],
      schedule: const [],
      routesTriggered: false,
      clearSelectedRoute: true,
      clearSavedPlanId: true,
      clearCostSummary: true,
      clearRoutesError: true,
      clearScheduleError: true,
    );
  }

  int? _currentAppUserId() {
    final token = ref.read(authControllerProvider).accessToken;
    if (token == null || token.isEmpty) return null;
    return getAppUserIdFromToken(token) ?? getUserIdFromToken(token);
  }

  List<Map<String, dynamic>>? _newsTop10Payload() {
    final items = ref.read(newsContextProvider).items;
    if (items.isEmpty) return null;
    return items.map((e) => e.toJson()).toList();
  }

  Future<void> fetchRoutes() async {
    final location = state.location.trim();
    if (location.isEmpty) {
      state = state.copyWith(statusMessage: "지역 코드를 입력해 주세요.");
      return;
    }

    state = state.copyWith(
      routesLoading: true,
      routesTriggered: true,
      statusMessage: "추천 루트를 생성하는 중...",
      clearRoutesError: true,
      routes: const [],
      schedule: const [],
      clearSelectedRoute: true,
      clearSavedPlanId: true,
      clearCostSummary: true,
    );

    try {
      List<String> existingRoutes = const [];
      final userId = _currentAppUserId();
      if (userId != null) {
        try {
          final saved = await _repo.fetchMyPlans(userId);
          existingRoutes = saved.map((e) => e.routeName).toList();
        } catch (_) {
          // 기존 루트 조회 실패는 무시하고 생성 진행
        }
      }
      final result = await _repo.fetchRoutes(
        location: location,
        startDate: state.startDate,
        endDate: state.endDate,
        userId: userId,
        existingRoutes: existingRoutes.isEmpty ? null : existingRoutes,
        useSearch: state.useSearch,
        newsTop10: _newsTop10Payload(),
        transportMode: state.transportMode,
      );
      final routes = result.routes;
      state = state.copyWith(
        routesLoading: false,
        routes: routes,
        selectedRouteName: routes.isNotEmpty ? routes.first.name : null,
        routesError: routes.isEmpty ? result.error : null,
        statusMessage: routes.isEmpty
            ? (result.error ?? "screens.planner.msg_no_routes".tr())
            : "screens.planner.msg_routes_received".tr(namedArgs: {"count": "${routes.length}"}),
      );
    } catch (e) {
      state = state.copyWith(
        routesLoading: false,
        routesError: "screens.planner.msg_route_failed".tr(namedArgs: {"error": "$e"}),
        statusMessage: "screens.planner.msg_route_failed".tr(namedArgs: {"error": "$e"}),
      );
    }
  }

  void selectRoute(String? routeName) {
    if (routeName == null || routeName.isEmpty) return;
    state = state.copyWith(selectedRouteName: routeName);
  }

  Future<void> fetchSchedule() async {
    final location = state.location.trim();
    final routeName = state.selectedRouteName?.trim() ?? "";
    if (location.isEmpty || routeName.isEmpty) {
      state = state.copyWith(statusMessage: "screens.planner.status_pick_route".tr());
      return;
    }

    state = state.copyWith(
      scheduleLoading: true,
      statusMessage: "screens.planner.msg_schedule_generating".tr(),
      clearScheduleError: true,
      schedule: const [],
      clearCostSummary: true,
      clearSavedPlanId: true,
    );

    try {
      final result = await _repo.fetchSchedule(
        location: location,
        routeName: routeName,
        startDate: state.startDate,
        endDate: state.endDate,
        userId: _currentAppUserId(),
        useSearch: state.useSearch,
        newsTop10: _newsTop10Payload(),
        transportMode: state.transportMode,
      );
      state = state.copyWith(
        scheduleLoading: false,
        schedule: result.schedule,
        costSummary: result.costSummary,
        scheduleError: result.schedule.isEmpty ? result.error : null,
        statusMessage: result.schedule.isEmpty
            ? (result.error ?? "일정을 받지 못했습니다.")
            : "일정 ${result.schedule.length}개 항목 생성 완료",
      );
    } catch (e) {
      state = state.copyWith(
        scheduleLoading: false,
        scheduleError: "일정 조회 실패: $e",
        statusMessage: "일정 조회 실패: $e",
      );
    }
  }

  Future<void> savePlan() async {
    final userId = _currentAppUserId();
    final routeName = state.selectedRouteName;
    if (routeName == null || routeName.isEmpty || state.schedule.isEmpty) {
      state = state.copyWith(statusMessage: "screens.planner.msg_nothing_to_save".tr());
      return;
    }
    state = state.copyWith(saving: true, statusMessage: "screens.planner.msg_saving_plan".tr());
    try {
      final res = await _repo.savePlan(
        location: state.location,
        routeName: routeName,
        startDate: state.startDate,
        endDate: state.endDate,
        schedule: state.schedule,
        userId: userId,
      );
      state = state.copyWith(
        saving: false,
        savedPlanId: res.planId,
        statusMessage: "screens.planner.msg_saved_plan".tr(namedArgs: {"id": "${res.planId}"}),
      );
    } catch (e) {
      state = state.copyWith(
        saving: false,
        statusMessage: "screens.planner.msg_save_failed".tr(namedArgs: {"error": "$e"}),
      );
    }
  }
}
