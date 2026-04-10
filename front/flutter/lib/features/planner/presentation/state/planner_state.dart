import "../../data/planner_models.dart";

class PlannerState {
  const PlannerState({
    required this.routesLoading,
    required this.scheduleLoading,
    required this.saving,
    required this.location,
    required this.startDate,
    required this.endDate,
    required this.statusMessage,
    required this.routesError,
    required this.scheduleError,
    required this.routesTriggered,
    required this.routes,
    required this.selectedRouteName,
    required this.schedule,
    required this.costSummary,
    required this.savedPlanId,
    required this.useSearch,
    required this.transportMode,
  });

  factory PlannerState.initial() {
    return const PlannerState(
      routesLoading: false,
      scheduleLoading: false,
      saving: false,
      location: "seoul",
      startDate: "",
      endDate: "",
      statusMessage: "",
      routesError: null,
      scheduleError: null,
      routesTriggered: false,
      routes: <PlanRoute>[],
      selectedRouteName: null,
      schedule: <ScheduleItem>[],
      costSummary: null,
      savedPlanId: null,
      useSearch: true,
      transportMode: "car",
    );
  }

  final bool routesLoading;
  final bool scheduleLoading;
  final bool saving;
  final String location;
  final String startDate;
  final String endDate;
  final String statusMessage;
  final String? routesError;
  final String? scheduleError;
  final bool routesTriggered;
  final List<PlanRoute> routes;
  final String? selectedRouteName;
  final List<ScheduleItem> schedule;
  final CostSummary? costSummary;
  final int? savedPlanId;
  final bool useSearch;
  final String transportMode;

  PlannerState copyWith({
    bool? routesLoading,
    bool? scheduleLoading,
    bool? saving,
    String? location,
    String? startDate,
    String? endDate,
    String? statusMessage,
    String? routesError,
    String? scheduleError,
    bool clearRoutesError = false,
    bool clearScheduleError = false,
    bool? routesTriggered,
    List<PlanRoute>? routes,
    String? selectedRouteName,
    bool clearSelectedRoute = false,
    List<ScheduleItem>? schedule,
    CostSummary? costSummary,
    bool clearCostSummary = false,
    int? savedPlanId,
    bool clearSavedPlanId = false,
    bool? useSearch,
    String? transportMode,
  }) {
    return PlannerState(
      routesLoading: routesLoading ?? this.routesLoading,
      scheduleLoading: scheduleLoading ?? this.scheduleLoading,
      saving: saving ?? this.saving,
      location: location ?? this.location,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      statusMessage: statusMessage ?? this.statusMessage,
      routesError: clearRoutesError ? null : (routesError ?? this.routesError),
      scheduleError: clearScheduleError ? null : (scheduleError ?? this.scheduleError),
      routesTriggered: routesTriggered ?? this.routesTriggered,
      routes: routes ?? this.routes,
      selectedRouteName: clearSelectedRoute ? null : (selectedRouteName ?? this.selectedRouteName),
      schedule: schedule ?? this.schedule,
      costSummary: clearCostSummary ? null : (costSummary ?? this.costSummary),
      savedPlanId: clearSavedPlanId ? null : (savedPlanId ?? this.savedPlanId),
      useSearch: useSearch ?? this.useSearch,
      transportMode: transportMode ?? this.transportMode,
    );
  }
}
