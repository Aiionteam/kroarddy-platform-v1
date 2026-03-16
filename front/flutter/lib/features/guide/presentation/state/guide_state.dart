import "../../data/guide_models.dart";

class GuideState {
  const GuideState({
    required this.loading,
    required this.year,
    required this.month,
    required this.selectedDay,
    required this.items,
    required this.statusMessage,
    required this.errorMessage,
  });

  factory GuideState.initial() {
    final now = DateTime.now();
    return GuideState(
      loading: false,
      year: now.year,
      month: now.month,
      selectedDay: null,
      items: const <FestivalItem>[],
      statusMessage: "행사 정보를 불러와 주세요.",
      errorMessage: null,
    );
  }

  final bool loading;
  final int year;
  final int month;
  final int? selectedDay;
  final List<FestivalItem> items;
  final String statusMessage;
  final String? errorMessage;

  GuideState copyWith({
    bool? loading,
    int? year,
    int? month,
    int? selectedDay,
    List<FestivalItem>? items,
    String? statusMessage,
    String? errorMessage,
    bool clearSelectedDay = false,
    bool clearError = false,
  }) {
    return GuideState(
      loading: loading ?? this.loading,
      year: year ?? this.year,
      month: month ?? this.month,
      selectedDay: clearSelectedDay ? null : (selectedDay ?? this.selectedDay),
      items: items ?? this.items,
      statusMessage: statusMessage ?? this.statusMessage,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}
