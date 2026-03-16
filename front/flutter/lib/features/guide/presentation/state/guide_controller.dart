import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../data/guide_models.dart";
import "../../data/guide_repository.dart";
import "guide_state.dart";

final guideControllerProvider = NotifierProvider<GuideController, GuideState>(
  GuideController.new,
);

class GuideController extends Notifier<GuideState> {
  GuideRepository get _repo => ref.read(guideRepositoryProvider);

  @override
  GuideState build() {
    final initial = GuideState.initial();
    Future<void>.microtask(loadFestivals);
    return initial;
  }

  Future<void> loadFestivals() async {
    state = state.copyWith(
      loading: true,
      statusMessage: "행사 정보를 불러오는 중...",
      clearError: true,
    );
    try {
      final data = await _repo.fetchFestivals(year: state.year, month: state.month);
      state = state.copyWith(
        loading: false,
        items: data.items,
        statusMessage: data.noData
            ? "해당 월에 등록된 행사가 없습니다."
            : "행사 ${data.items.length}건을 불러왔습니다.",
        errorMessage: data.error,
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        items: const <FestivalItem>[],
        statusMessage: "행사 로드 실패",
        errorMessage: e.toString(),
      );
    }
  }

  void selectDay(int? day) {
    if (day == null) {
      state = state.copyWith(clearSelectedDay: true);
      return;
    }
    state = state.copyWith(selectedDay: day);
  }

  void goPrevMonth() {
    final newYear = state.month == 1 ? state.year - 1 : state.year;
    final newMonth = state.month == 1 ? 12 : state.month - 1;
    state = state.copyWith(
      year: newYear,
      month: newMonth,
      clearSelectedDay: true,
    );
    Future<void>.microtask(loadFestivals);
  }

  void goNextMonth() {
    final newYear = state.month == 12 ? state.year + 1 : state.year;
    final newMonth = state.month == 12 ? 1 : state.month + 1;
    state = state.copyWith(
      year: newYear,
      month: newMonth,
      clearSelectedDay: true,
    );
    Future<void>.microtask(loadFestivals);
  }

  List<FestivalItem> filteredItems() {
    final day = state.selectedDay;
    if (day == null) return state.items;
    final target = state.year * 10000 + state.month * 100 + day;
    return state.items.where((it) {
      final s = _toInt(it.fstvlStartDate);
      final e = _toInt(it.fstvlEndDate) ?? s ?? 99991231;
      return s != null && target >= s && target <= e;
    }).toList();
  }

  List<int> daysWithEvents() {
    final days = <int>{};
    for (final it in state.items) {
      final s = _toInt(it.fstvlStartDate);
      final e = _toInt(it.fstvlEndDate) ?? s;
      if (s == null || e == null) continue;
      final first = DateTime(state.year, state.month, 1);
      final last = DateTime(state.year, state.month + 1, 0);
      final start = _maxDate(_fromYmd(s), first);
      final end = _minDate(_fromYmd(e), last);
      if (end.isBefore(start)) continue;
      for (var d = start.day; d <= end.day; d++) {
        days.add(d);
      }
    }
    final out = days.toList()..sort();
    return out;
  }

  int? _toInt(String raw) {
    if (raw.length < 8) return null;
    final digits = raw.replaceAll(RegExp(r"\D"), "");
    if (digits.length < 8) return null;
    return int.tryParse(digits.substring(0, 8));
  }

  DateTime _fromYmd(int ymd) {
    final y = ymd ~/ 10000;
    final m = (ymd % 10000) ~/ 100;
    final d = ymd % 100;
    return DateTime(y, m, d);
  }

  DateTime _maxDate(DateTime a, DateTime b) => a.isAfter(b) ? a : b;
  DateTime _minDate(DateTime a, DateTime b) => a.isBefore(b) ? a : b;
}
