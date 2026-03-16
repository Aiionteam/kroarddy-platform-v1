import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../data/planner_repository.dart";
import "planner_state.dart";

final plannerControllerProvider = NotifierProvider<PlannerController, PlannerState>(
  PlannerController.new,
);

class PlannerController extends Notifier<PlannerState> {
  PlannerRepository get _repo => ref.read(plannerRepositoryProvider);

  @override
  PlannerState build() => PlannerState.initial();

  void setLocation(String value) {
    state = state.copyWith(location: value.trim().toLowerCase());
  }

  Future<void> fetchRoutes() async {
    final location = state.location.trim();
    if (location.isEmpty) {
      state = state.copyWith(statusMessage: "지역 코드를 입력해 주세요.");
      return;
    }

    state = state.copyWith(
      loading: true,
      statusMessage: "추천 루트를 생성하는 중...",
      routes: const [],
      schedule: const [],
      clearSelectedRoute: true,
    );

    try {
      final result = await _repo.fetchRoutes(location: location);
      final routes = result.routes;
      state = state.copyWith(
        loading: false,
        routes: routes,
        selectedRouteName: routes.isNotEmpty ? routes.first.name : null,
        statusMessage: routes.isEmpty
            ? (result.error ?? "추천 루트를 받지 못했습니다.")
            : "추천 루트 ${routes.length}개를 받았습니다.",
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        statusMessage: "루트 조회 실패: $e",
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
      state = state.copyWith(statusMessage: "지역과 루트를 먼저 선택해 주세요.");
      return;
    }

    state = state.copyWith(
      loading: true,
      statusMessage: "선택 루트 일정 생성 중...",
      schedule: const [],
    );

    try {
      final result = await _repo.fetchSchedule(location: location, routeName: routeName);
      state = state.copyWith(
        loading: false,
        schedule: result.schedule,
        statusMessage: result.schedule.isEmpty
            ? (result.error ?? "일정을 받지 못했습니다.")
            : "일정 ${result.schedule.length}개 항목 생성 완료",
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        statusMessage: "일정 조회 실패: $e",
      );
    }
  }
}
