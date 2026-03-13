import "../../data/planner_models.dart";

class PlannerState {
  const PlannerState({
    required this.loading,
    required this.location,
    required this.statusMessage,
    required this.routes,
    required this.selectedRouteName,
    required this.schedule,
  });

  factory PlannerState.initial() {
    return const PlannerState(
      loading: false,
      location: "seoul",
      statusMessage: "지역 코드를 입력하고 루트 추천을 받아보세요. (예: seoul, busan)",
      routes: <PlanRoute>[],
      selectedRouteName: null,
      schedule: <ScheduleItem>[],
    );
  }

  final bool loading;
  final String location;
  final String statusMessage;
  final List<PlanRoute> routes;
  final String? selectedRouteName;
  final List<ScheduleItem> schedule;

  PlannerState copyWith({
    bool? loading,
    String? location,
    String? statusMessage,
    List<PlanRoute>? routes,
    String? selectedRouteName,
    bool clearSelectedRoute = false,
    List<ScheduleItem>? schedule,
  }) {
    return PlannerState(
      loading: loading ?? this.loading,
      location: location ?? this.location,
      statusMessage: statusMessage ?? this.statusMessage,
      routes: routes ?? this.routes,
      selectedRouteName: clearSelectedRoute ? null : (selectedRouteName ?? this.selectedRouteName),
      schedule: schedule ?? this.schedule,
    );
  }
}
