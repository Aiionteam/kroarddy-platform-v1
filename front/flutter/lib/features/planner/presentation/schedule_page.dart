import "dart:math" as math;

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_naver_map/flutter_naver_map.dart";
import "package:go_router/go_router.dart";
import "package:url_launcher/url_launcher.dart";
import "../../../core/auth/jwt_claims.dart";
import "../../../core/router/main_shell.dart";
import "../../auth/presentation/state/auth_controller.dart";
import "../data/planner_models.dart";
import "../data/planner_repository.dart";

const _purple = Color(0xFF7C3AED);
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _bgPage = Color(0xFFF8F7FF);
/// 웹 `NaverRouteMapModal`과 동일 — 한국 범위·중복 좌표 필터
const _kKoreaLatMin = 33.0;
const _kKoreaLatMax = 38.7;
const _kKoreaLngMin = 124.5;
const _kKoreaLngMax = 132.0;
const _routeDedupeThresholdM = 50.0;

bool _isValidKoreaMapCoord(double lat, double lng) {
  if (lat == 0 && lng == 0) return false;
  if (!lat.isFinite || !lng.isFinite) return false;
  return lat >= _kKoreaLatMin &&
      lat <= _kKoreaLatMax &&
      lng >= _kKoreaLngMin &&
      lng <= _kKoreaLngMax;
}

double _radForMap(double deg) => deg * math.pi / 180.0;

double _haversineMeters(double lat1, double lng1, double lat2, double lng2) {
  const r = 6371000.0;
  final dLat = _radForMap(lat2 - lat1);
  final dLng = _radForMap(lng2 - lng1);
  final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(_radForMap(lat1)) *
          math.cos(_radForMap(lat2)) *
          math.sin(dLng / 2) *
          math.sin(dLng / 2);
  return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
}

List<({double lat, double lng, String name})> _dedupeRoutePlacesByDistance(
  List<({double lat, double lng, String name})> input,
) {
  if (input.length <= 1) return input;
  final out = <({double lat, double lng, String name})>[input.first];
  for (var i = 1; i < input.length; i++) {
    final cur = input[i];
    final prev = out.last;
    if (_haversineMeters(prev.lat, prev.lng, cur.lat, cur.lng) >
        _routeDedupeThresholdM) {
      out.add(cur);
    }
  }
  return out;
}

Future<DirectionsRouteDto?> _fetchCarDirectionsForPlaces(
  PlannerRepository repo,
  List<({double lat, double lng, String name})> resolved,
) async {
  final valid =
      resolved.where((p) => _isValidKoreaMapCoord(p.lat, p.lng)).toList();
  if (valid.length < 2) return null;

  final deduped = _dedupeRoutePlacesByDistance(valid);
  if (deduped.length < 2) return null;

  final limited = deduped.length > 7 ? deduped.sublist(0, 7) : deduped;
  final start = limited.first;
  final goal = limited.last;
  final wp = limited
      .sublist(1, limited.length - 1)
      .map((e) => (lat: e.lat, lng: e.lng))
      .toList();

  return repo.fetchDirections(
    startLat: start.lat,
    startLng: start.lng,
    goalLat: goal.lat,
    goalLng: goal.lng,
    waypoints: wp,
  );
}

const _planDots = <Color>[
  Color(0xFF6366F1),
  Color(0xFFA855F7),
  Color(0xFF14B8A6),
  Color(0xFFF59E0B),
  Color(0xFFF43F5E),
  Color(0xFF10B981),
  Color(0xFF0EA5E9),
  Color(0xFFF97316),
];

class _PlanPalette {
  const _PlanPalette({
    required this.dot,
    required this.light,
    required this.border,
    required this.text,
    required this.badgeBg,
  });

  final Color dot;
  final Color light;
  final Color border;
  final Color text;
  final Color badgeBg;
}

const _planPalettes = <_PlanPalette>[
  _PlanPalette(
    dot: Color(0xFF6366F1),
    light: Color(0xFFEEF2FF),
    border: Color(0xFFC7D2FE),
    text: Color(0xFF3730A3),
    badgeBg: Color(0xFFE0E7FF),
  ),
  _PlanPalette(
    dot: Color(0xFFA855F7),
    light: Color(0xFFFAF5FF),
    border: Color(0xFFE9D5FF),
    text: Color(0xFF7E22CE),
    badgeBg: Color(0xFFF3E8FF),
  ),
  _PlanPalette(
    dot: Color(0xFF14B8A6),
    light: Color(0xFFF0FDFA),
    border: Color(0xFF99F6E4),
    text: Color(0xFF0F766E),
    badgeBg: Color(0xFFCCFBF1),
  ),
  _PlanPalette(
    dot: Color(0xFFF59E0B),
    light: Color(0xFFFFFBEB),
    border: Color(0xFFFDE68A),
    text: Color(0xFF92400E),
    badgeBg: Color(0xFFFEF3C7),
  ),
  _PlanPalette(
    dot: Color(0xFFF43F5E),
    light: Color(0xFFFFF1F2),
    border: Color(0xFFFDA4AF),
    text: Color(0xFFBE123C),
    badgeBg: Color(0xFFFFE4E6),
  ),
  _PlanPalette(
    dot: Color(0xFF10B981),
    light: Color(0xFFECFDF5),
    border: Color(0xFFA7F3D0),
    text: Color(0xFF047857),
    badgeBg: Color(0xFFD1FAE5),
  ),
  _PlanPalette(
    dot: Color(0xFF0EA5E9),
    light: Color(0xFFF0F9FF),
    border: Color(0xFFBAE6FD),
    text: Color(0xFF0369A1),
    badgeBg: Color(0xFFE0F2FE),
  ),
  _PlanPalette(
    dot: Color(0xFFF97316),
    light: Color(0xFFFFF7ED),
    border: Color(0xFFFED7AA),
    text: Color(0xFFC2410C),
    badgeBg: Color(0xFFFFEDD5),
  ),
];

class SchedulePage extends ConsumerStatefulWidget {
  const SchedulePage({super.key});

  @override
  ConsumerState<SchedulePage> createState() => _SchedulePageState();
}

class _SchedulePageState extends ConsumerState<SchedulePage> {
  DateTime _focusedMonth = DateTime.now();
  DateTime? _selectedDate;
  bool _loading = false;
  String? _error;
  List<TravelPlanRecord> _plans = const [];
  int? _modifyingPlanId;
  int? _deletingPlanId;
  String? _rerollingKey;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadPlans());
  }

  int? _currentAppUserId() {
    final token = ref.read(authControllerProvider).accessToken;
    if (token == null || token.isEmpty) return null;
    return getAppUserIdFromToken(token) ?? getUserIdFromToken(token);
  }

  String _fmt(DateTime d) {
    final m = d.month.toString().padLeft(2, "0");
    final day = d.day.toString().padLeft(2, "0");
    return "${d.year}-$m-$day";
  }

  Future<void> _loadPlans() async {
    final userId = _currentAppUserId();
    if (userId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final plans = await ref.read(plannerRepositoryProvider).fetchMyPlans(userId);
      if (!mounted) return;
      setState(() => _plans = plans);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = "플랜 목록을 불러오지 못했습니다: $e");
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool _isPlanOnDate(TravelPlanRecord p, DateTime date) {
    final d = _fmt(date);
    final start = p.startDate;
    final end = p.endDate ?? p.startDate;
    if (start == null || end == null) return false;
    return start.compareTo(d) <= 0 && end.compareTo(d) >= 0;
  }

  String? _resolveItemDate(ScheduleItem item, TravelPlanRecord plan) {
    final raw = item.date.trim();
    final iso = RegExp(r"^\d{4}-\d{2}-\d{2}$");
    if (iso.hasMatch(raw)) return raw;
    final dayMatch = RegExp(r"Day\s*(\d+)", caseSensitive: false).firstMatch(raw);
    final n = dayMatch != null ? int.tryParse(dayMatch.group(1) ?? "") : item.day;
    if (n == null || n <= 0 || plan.startDate == null) return null;
    final start = DateTime.tryParse(plan.startDate!);
    if (start == null) return null;
    return _fmt(start.add(Duration(days: n - 1)));
  }

  List<MapEntry<int, ScheduleItem>> _itemsOnDate(TravelPlanRecord plan, DateTime date) {
    final target = _fmt(date);
    return plan.schedule.asMap().entries.where((e) {
      final resolved = _resolveItemDate(e.value, plan);
      return resolved == target;
    }).toList();
  }

  List<TravelPlanRecord> _selectedPlans() {
    if (_selectedDate == null) return _plans;
    return _plans.where((p) => _isPlanOnDate(p, _selectedDate!)).toList();
  }

  Color _dotForPlan(int idx) => _planDots[idx % _planDots.length];
  _PlanPalette _paletteForPlan(int idx) => _planPalettes[idx % _planPalettes.length];

  Future<void> _deletePlan(int planId) async {
    final userId = _currentAppUserId();
    if (userId == null) return;
    try {
      setState(() => _deletingPlanId = planId);
      await ref.read(plannerRepositoryProvider).deletePlan(planId: planId, userId: userId);
      if (!mounted) return;
      setState(() => _plans = _plans.where((e) => e.id != planId).toList());
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("삭제 실패: $e")),
      );
    } finally {
      if (mounted) setState(() => _deletingPlanId = null);
    }
  }

  Future<void> _modifyPlan(TravelPlanRecord plan) async {
    final userId = _currentAppUserId();
    if (userId == null) return;
    final ctrl = TextEditingController();
    final instruction = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("AI 수정 요청"),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          decoration: const InputDecoration(hintText: "예) 오후 일정을 실내 위주로 바꿔줘"),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("취소")),
          FilledButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim()), child: const Text("수정")),
        ],
      ),
    );
    if (instruction == null || instruction.isEmpty) return;
    try {
      setState(() => _modifyingPlanId = plan.id);
      final res = await ref.read(plannerRepositoryProvider).modifyPlan(
            planId: plan.id,
            userId: userId,
            instruction: instruction,
          );
      if (!mounted) return;
      setState(() {
        _plans = _plans
            .map((p) => p.id == plan.id
                ? TravelPlanRecord(
                    id: p.id,
                    userId: p.userId,
                    location: p.location,
                    routeName: p.routeName,
                    startDate: p.startDate,
                    endDate: p.endDate,
                    schedule: res.schedule,
                    createdAt: p.createdAt,
                  )
                : p)
            .toList();
      });
      if (res.reason != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res.reason!)));
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("수정 실패: $e")));
    } finally {
      if (mounted) setState(() => _modifyingPlanId = null);
    }
  }

  Future<void> _rerollItem(TravelPlanRecord plan, int idx) async {
    final userId = _currentAppUserId();
    if (userId == null) return;
    try {
      setState(() => _rerollingKey = "${plan.id}:$idx");
      final res = await ref.read(plannerRepositoryProvider).rerollPlanItem(
            planId: plan.id,
            itemIndex: idx,
            userId: userId,
          );
      if (!mounted) return;
      setState(() {
        _plans = _plans
            .map((p) => p.id == plan.id
                ? TravelPlanRecord(
                    id: p.id,
                    userId: p.userId,
                    location: p.location,
                    routeName: p.routeName,
                    startDate: p.startDate,
                    endDate: p.endDate,
                    schedule: res.schedule,
                    createdAt: p.createdAt,
                  )
                : p)
            .toList();
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("리롤 실패: $e")));
    } finally {
      if (mounted) setState(() => _rerollingKey = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bgPage,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.menu, color: _textPrimary),
          onPressed: () => mainScaffoldKey.currentState?.openDrawer(),
        ),
        title: const Text(
          "일정 관리",
          style: TextStyle(color: _textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          TextButton(
            onPressed: () => context.push("/planner"),
            style: TextButton.styleFrom(
              foregroundColor: _purple,
              textStyle: const TextStyle(fontWeight: FontWeight.w700),
            ),
            child: const Text("+ 새 루트"),
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            margin: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chevron_left, color: _textSecondary),
                      onPressed: () => setState(() {
                        _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month - 1);
                      }),
                    ),
                    Text(
                      "${_focusedMonth.year}년 ${_focusedMonth.month}월",
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: _textPrimary,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.chevron_right, color: _textSecondary),
                      onPressed: () => setState(() {
                        _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month + 1);
                      }),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: ["일", "월", "화", "수", "목", "금", "토"].map((d) {
                    final isSun = d == "일";
                    final isSat = d == "토";
                    return Expanded(
                      child: Center(
                        child: Text(
                          d,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: isSun
                                ? const Color(0xFFEF4444)
                                : isSat
                                    ? const Color(0xFF3B82F6)
                                    : _textSecondary,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 8),
                _buildCalendarGrid(),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                    : _selectedPlans().isEmpty
                        ? _buildEmptyState()
                        : _buildPlanList(
                            plans: _selectedDate != null ? _selectedPlans() : _plans,
                            selectedDate: _selectedDate,
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlanList({
    required List<TravelPlanRecord> plans,
    required DateTime? selectedDate,
  }) {
    final totalItems = selectedDate == null
        ? null
        : plans.fold<int>(0, (acc, p) => acc + _itemsOnDate(p, selectedDate).length);
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        if (selectedDate != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    "${selectedDate.year}년 ${selectedDate.month}월 ${selectedDate.day}일 · ${totalItems ?? 0}개 일정",
                    style: const TextStyle(fontWeight: FontWeight.w800, color: _textPrimary),
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() => _selectedDate = null),
                  style: TextButton.styleFrom(foregroundColor: _purple),
                  child: const Text("전체 보기"),
                ),
              ],
            ),
          ),
        ...plans.asMap().entries.map(
          (pair) {
            final fallbackIdx = pair.key;
            final p = pair.value;
            final originalIdx = _plans.indexWhere((e) => e.id == p.id);
            final dotColor = _dotForPlan(originalIdx >= 0 ? originalIdx : fallbackIdx);
            final palette = _paletteForPlan(originalIdx >= 0 ? originalIdx : fallbackIdx);
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: palette.border),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: ExpansionTile(
                key: PageStorageKey<String>("plan-tile-${p.id}"),
                initiallyExpanded: false,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                collapsedShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                leading: CircleAvatar(
                  radius: 8,
                  backgroundColor: dotColor,
                ),
                title: Text(
                  "${p.location} · ${p.routeName}",
                  style: TextStyle(fontWeight: FontWeight.w700, color: palette.text),
                ),
                subtitle: Text(
                  "${p.startDate ?? "-"} ~ ${p.endDate ?? "-"}",
                  style: TextStyle(fontSize: 12, color: palette.text.withValues(alpha: 0.75)),
                ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // 전체 경로 보기
                    IconButton(
                      tooltip: "전체 경로 보기",
                      onPressed: () {
                        final places = p.schedule
                            .where((s) => s.place.trim().isNotEmpty)
                            .map((s) => (
                                  name: s.place,
                                  lat: s.lat,
                                  lng: s.lng,
                                ))
                            .fold<List<({String name, double? lat, double? lng})>>(
                              [],
                              (acc, item) {
                                if (acc.every((e) => e.name != item.name)) acc.add(item);
                                return acc;
                              },
                            )
                            .take(5)
                            .toList();
                        if (places.isEmpty) return;
                        showDialog<void>(
                          context: context,
                          builder: (_) => _NaverRouteMapDialog(
                            places: places,
                            planName: "${p.location} · ${p.routeName}",
                            repo: ref.read(plannerRepositoryProvider),
                          ),
                        );
                      },
                      icon: Icon(Icons.map_outlined, color: palette.text, size: 20),
                    ),
                    IconButton(
                      tooltip: "AI 수정",
                      onPressed: _modifyingPlanId == p.id ? null : () => _modifyPlan(p),
                      icon: _modifyingPlanId == p.id
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(Icons.auto_fix_high, color: palette.text),
                    ),
                    IconButton(
                      tooltip: "삭제",
                      onPressed: _deletingPlanId == p.id ? null : () => _deletePlan(p.id),
                      icon: _deletingPlanId == p.id
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(Icons.delete_outline, color: palette.text),
                    ),
                  ],
                ),
                childrenPadding: const EdgeInsets.fromLTRB(8, 0, 8, 10),
                children: [
                  ...(() {
                    final grouped = <int, List<MapEntry<int, ScheduleItem>>>{};
                    for (final entry in p.schedule.asMap().entries) {
                      grouped.putIfAbsent(entry.value.day, () => <MapEntry<int, ScheduleItem>>[]).add(entry);
                    }
                    final dayEntries = grouped.entries.toList()
                      ..sort((a, b) => a.key.compareTo(b.key));

                    return dayEntries.expand((dayEntry) {
                      final day = dayEntry.key;
                      final items = dayEntry.value;
                      final dayDate = items.first.value.date;
                      return <Widget>[
                        Padding(
                          padding: const EdgeInsets.fromLTRB(6, 10, 6, 6),
                          child: Row(
                            children: [
                              Container(
                                width: 18,
                                height: 18,
                                decoration: BoxDecoration(
                                  color: palette.badgeBg,
                                  shape: BoxShape.circle,
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  "$day",
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: palette.text,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                dayDate.isEmpty ? "Day $day" : dayDate,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: palette.text,
                                ),
                              ),
                            ],
                          ),
                        ),
                        ...items.asMap().entries.map((indexed) {
                          final order = indexed.key + 1;
                          final e = indexed.value;
                          final item = e.value;
                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
                            decoration: BoxDecoration(
                              color: palette.light,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: palette.border.withValues(alpha: 0.75)),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: 20,
                                  height: 20,
                                  margin: const EdgeInsets.only(top: 2),
                                  decoration: BoxDecoration(
                                    color: palette.badgeBg,
                                    shape: BoxShape.circle,
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    "$order",
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: palette.text,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              item.title,
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w800,
                                                color: _textPrimary,
                                                fontSize: 15,
                                              ),
                                            ),
                                          ),
                                          if ((item.estimatedCost ?? "").isNotEmpty)
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFECFDF5),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: Text(
                                                item.estimatedCost!,
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w700,
                                                  color: Color(0xFF059669),
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      // 장소명 (탭하면 지도 열기)
                                      GestureDetector(
                                        onTap: () {
                                          showDialog<void>(
                                            context: context,
                                            builder: (_) => _NaverPlaceMapDialog(
                                              placeName: item.place,
                                              lat: item.lat,
                                              lng: item.lng,
                                              repo: ref.read(plannerRepositoryProvider),
                                            ),
                                          );
                                        },
                                        child: Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                "📍 ${item.place}",
                                                style: TextStyle(
                                                  color: palette.text.withValues(alpha: 0.9),
                                                  fontSize: 12,
                                                  decoration: TextDecoration.underline,
                                                  decorationColor: palette.text.withValues(alpha: 0.4),
                                                ),
                                              ),
                                            ),
                                            Text(
                                              "지도 보기 →",
                                              style: TextStyle(
                                                fontSize: 10,
                                                color: palette.text.withValues(alpha: 0.6),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      // 영업시간
                                      if ((item.businessHours ?? "").isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFF8FAFC),
                                            borderRadius: BorderRadius.circular(6),
                                            border: Border.all(color: const Color(0xFFE2E8F0)),
                                          ),
                                          child: Text(
                                            "🕐 ${item.businessHours!}",
                                            style: const TextStyle(fontSize: 11, color: Color(0xFF475569)),
                                          ),
                                        ),
                                      ],
                                      if (item.description.isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          item.description,
                                          style: TextStyle(
                                            color: palette.text.withValues(alpha: 0.8),
                                            fontSize: 12,
                                            height: 1.4,
                                          ),
                                        ),
                                      ],
                                      if ((item.tips ?? "").isNotEmpty) ...[
                                        const SizedBox(height: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFFFFBEB),
                                            borderRadius: BorderRadius.circular(8),
                                            border: Border.all(color: const Color(0xFFFDE68A)),
                                          ),
                                          child: Text(
                                            "💡 ${item.tips!}",
                                            style: const TextStyle(fontSize: 11, color: Color(0xFF92400E)),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 4),
                                IconButton(
                                  tooltip: "이 항목 리롤",
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                  onPressed: _rerollingKey == "${p.id}:${e.key}"
                                      ? null
                                      : () => _rerollItem(p, e.key),
                                  icon: _rerollingKey == "${p.id}:${e.key}"
                                      ? const SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(strokeWidth: 2),
                                        )
                                      : Icon(Icons.refresh, size: 20, color: palette.text.withValues(alpha: 0.6)),
                                ),
                              ],
                            ),
                          );
                        }),
                      ];
                    }).toList();
                  })(),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text("📋", style: TextStyle(fontSize: 48)),
          SizedBox(height: 12),
          Text(
            "저장된 플랜이 없습니다.",
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
          ),
          SizedBox(height: 6),
          Text(
            "여행플래너에서 AI 루트를 생성해보세요",
            style: TextStyle(fontSize: 13, color: _textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildCalendarGrid() {
    final firstDay = DateTime(_focusedMonth.year, _focusedMonth.month, 1);
    final lastDay = DateTime(_focusedMonth.year, _focusedMonth.month + 1, 0);
    final startWeekday = firstDay.weekday % 7;
    final totalCells = startWeekday + lastDay.day;
    final rows = (totalCells / 7).ceil();

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 7,
        childAspectRatio: 1,
      ),
      itemCount: rows * 7,
      itemBuilder: (context, index) {
        final dayIndex = index - startWeekday + 1;
        if (dayIndex < 1 || dayIndex > lastDay.day) return const SizedBox.shrink();

        final date = DateTime(_focusedMonth.year, _focusedMonth.month, dayIndex);
        final isSelected = _selectedDate != null &&
            _selectedDate!.year == date.year &&
            _selectedDate!.month == date.month &&
            _selectedDate!.day == date.day;
        final isToday = DateTime.now().year == date.year &&
            DateTime.now().month == date.month &&
            DateTime.now().day == date.day;
        final matchedPlanIndexes = _plans
            .asMap()
            .entries
            .where((e) => _isPlanOnDate(e.value, date))
            .map((e) => e.key)
            .toList();

        return GestureDetector(
          onTap: () => setState(() {
            _selectedDate = isSelected ? null : date;
          }),
          child: Container(
            margin: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              color: isSelected ? _purple : Colors.transparent,
              shape: BoxShape.circle,
              border: isToday && !isSelected ? Border.all(color: _purple, width: 1.5) : null,
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Text(
                  "$dayIndex",
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isSelected || isToday ? FontWeight.bold : FontWeight.normal,
                    color: isSelected
                        ? Colors.white
                        : index % 7 == 0
                            ? const Color(0xFFEF4444)
                            : index % 7 == 6
                                ? const Color(0xFF3B82F6)
                                : _textPrimary,
                  ),
                ),
                if (matchedPlanIndexes.isNotEmpty && !isSelected)
                  Positioned(
                    bottom: 4,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: matchedPlanIndexes
                          .take(3)
                          .map(
                            (idx) => Container(
                              width: 4,
                              height: 4,
                              margin: const EdgeInsets.symmetric(horizontal: 1),
                              decoration: BoxDecoration(
                                color: _dotForPlan(idx),
                                shape: BoxShape.circle,
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ══════════════════════════════════════════════════════════════
// 개별 장소 지도 다이얼로그 (네이버 동적 지도)
// ══════════════════════════════════════════════════════════════
class _NaverPlaceMapDialog extends StatefulWidget {
  const _NaverPlaceMapDialog({
    required this.placeName,
    required this.repo,
    this.lat,
    this.lng,
  });
  final String placeName;
  final double? lat;
  final double? lng;
  final PlannerRepository repo;

  @override
  State<_NaverPlaceMapDialog> createState() => _NaverPlaceMapDialogState();
}

class _NaverPlaceMapDialogState extends State<_NaverPlaceMapDialog> {
  String _status = "loading";
  String _errorMsg = "";
  double? _resolvedLat;
  double? _resolvedLng;
  double _zoom = 15;
  NaverMapController? _controller;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    double? lat = widget.lat;
    double? lng = widget.lng;

    // 좌표 없으면 place-search로 조회
    if (lat == null || lng == null) {
      try {
        final data = await widget.repo.placeSearch(widget.placeName);
        if (!mounted) return;
        lng = double.tryParse(data["x"]?.toString() ?? "");
        lat = double.tryParse(data["y"]?.toString() ?? "");
        if (lat == null || lng == null) {
          if (mounted) setState(() { _status = "error"; _errorMsg = "장소 좌표를 찾을 수 없습니다."; });
          return;
        }
      } catch (e) {
        if (mounted) setState(() { _status = "error"; _errorMsg = e.toString(); });
        return;
      }
    }

    _resolvedLat = lat;
    _resolvedLng = lng;
    if (mounted) setState(() => _status = "ok");
  }

  void _changeZoom(int delta) {
    if (_resolvedLat == null || _resolvedLng == null) return;
    final newZoom = (_zoom + delta).clamp(6, 19).toDouble();
    if (newZoom == _zoom) return;
    _zoom = newZoom;
    final target = NLatLng(_resolvedLat!, _resolvedLng!);
    _controller?.updateCamera(
      NCameraUpdate.scrollAndZoomTo(target: target, zoom: _zoom),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.all(16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 헤더
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)]),
              ),
              child: Row(
                children: [
                  const Text("📍", style: TextStyle(fontSize: 18)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.placeName,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            // 지도 영역
            SizedBox(
              width: double.infinity,
              height: 300,
              child: _buildMapContent(),
            ),
            // 하단 버튼
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      _ZoomBtn(icon: Icons.remove, onTap: () => _changeZoom(-1)),
                      const SizedBox(width: 4),
                      _ZoomBtn(icon: Icons.add, onTap: () => _changeZoom(1)),
                    ],
                  ),
                  TextButton.icon(
                    onPressed: () async {
                      final uri = Uri.parse("https://map.naver.com/p/search/${Uri.encodeComponent(widget.placeName)}");
                      try { await launchUrl(uri, mode: LaunchMode.externalApplication); } catch (_) {}
                    },
                    icon: const Icon(Icons.open_in_new, size: 14),
                    label: const Text("네이버 지도로 열기"),
                    style: TextButton.styleFrom(foregroundColor: const Color(0xFF6366F1), textStyle: const TextStyle(fontSize: 12)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMapContent() {
    if (_status == "loading") {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 8),
            Text("지도를 불러오는 중…", style: TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
      );
    }
    if (_status == "error" || _resolvedLat == null || _resolvedLng == null) {
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text("🗺️", style: TextStyle(fontSize: 32)),
          const SizedBox(height: 8),
          const Text("지도를 불러올 수 없습니다", style: TextStyle(fontSize: 13, color: Colors.grey)),
          if (_errorMsg.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Text(
                _errorMsg,
                style: const TextStyle(fontSize: 11, color: Color(0xFFEF4444)),
                textAlign: TextAlign.center,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: () async {
              final uri = Uri.parse("https://map.naver.com/p/search/${Uri.encodeComponent(widget.placeName)}");
              try { await launchUrl(uri, mode: LaunchMode.externalApplication); } catch (_) {}
            },
            icon: const Icon(Icons.open_in_new, size: 16),
            label: const Text("네이버 지도에서 보기"),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1), foregroundColor: Colors.white),
          ),
        ],
      );
    }
    final target = NLatLng(_resolvedLat!, _resolvedLng!);
    final safePadding = MediaQuery.paddingOf(context);
    return Stack(
      children: [
        NaverMap(
          options: NaverMapViewOptions(
            contentPadding: safePadding,
            initialCameraPosition: NCameraPosition(target: target, zoom: _zoom),
            indoorEnable: true,
            locationButtonEnable: false,
            logoClickEnable: false,
          ),
          onMapReady: (controller) async {
            _controller = controller;
            final marker = NMarker(
              id: "place",
              position: target,
              caption: NOverlayCaption(text: widget.placeName),
            );
            await controller.addOverlay(marker);
          },
        ),
        Positioned(
          right: 12,
          top: 12,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.92),
              borderRadius: BorderRadius.circular(12),
              boxShadow: const [BoxShadow(color: Color(0x22000000), blurRadius: 10, offset: Offset(0, 4))],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.add, size: 18),
                  onPressed: () => _changeZoom(1),
                  tooltip: "확대",
                ),
                const Divider(height: 1),
                IconButton(
                  icon: const Icon(Icons.remove, size: 18),
                  onPressed: () => _changeZoom(-1),
                  tooltip: "축소",
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// `NaverRouteMapModal` 교통수단 탭과 동작 정렬
enum _RouteTransportMode { car, walk, transit }

extension on _RouteTransportMode {
  String get label => switch (this) {
        _RouteTransportMode.car => "차량",
        _RouteTransportMode.walk => "도보",
        _RouteTransportMode.transit => "대중교통",
      };
  String get emoji => switch (this) {
        _RouteTransportMode.car => "🚗",
        _RouteTransportMode.walk => "🚶",
        _RouteTransportMode.transit => "🚌",
      };
  Color get accent => switch (this) {
        _RouteTransportMode.car => const Color(0xFF6366F1),
        _RouteTransportMode.walk => const Color(0xFF10B981),
        _RouteTransportMode.transit => const Color(0xFF0EA5E9),
      };
}

double _totalStraightDistanceM(
  List<({double lat, double lng, String name})> places,
) {
  if (places.length < 2) return 0;
  var total = 0.0;
  for (var i = 0; i < places.length - 1; i++) {
    total += _haversineMeters(
      places[i].lat,
      places[i].lng,
      places[i + 1].lat,
      places[i + 1].lng,
    );
  }
  return total;
}

String _naverTransitSegmentUrl(
  List<({double lat, double lng, String name})> places,
  int index,
) {
  if (index <= 0 || index >= places.length) return "";
  final a = places[index - 1];
  final b = places[index];
  final sName = Uri.encodeComponent(a.name);
  final gName = Uri.encodeComponent(b.name);
  return "https://map.naver.com/v5/directions/"
      "${a.lng},${a.lat},$sName/${b.lng},${b.lat},$gName/-/transit";
}

// ══════════════════════════════════════════════════════════════
// 전체 경로 지도 다이얼로그 (동적 지도 + 백엔드 Directions 도로 경로, 웹과 동일)
// ══════════════════════════════════════════════════════════════
class _NaverRouteMapDialog extends StatefulWidget {
  const _NaverRouteMapDialog({
    required this.places,
    required this.planName,
    required this.repo,
  });
  final List<({String name, double? lat, double? lng})> places;
  final String planName;
  final PlannerRepository repo;

  @override
  State<_NaverRouteMapDialog> createState() => _NaverRouteMapDialogState();
}

class _NaverRouteMapDialogState extends State<_NaverRouteMapDialog> {
  String _status = "loading";
  String _errorMsg = "";
  List<({double lat, double lng, String name})> _resolvedPlaces = [];
  /// 웹과 동일: 백엔드 Directions 성공 시 도로 폴리라인. 실패 시 null → 직선 점선.
  List<NLatLng>? _carRoutePoints;
  int? _routeDistanceM;
  int? _routeDurationMs;
  _RouteTransportMode _mode = _RouteTransportMode.car;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final resolved = <({double lat, double lng, String name})>[];
    for (final p in widget.places) {
      if (p.lat != null && p.lng != null) {
        resolved.add((lat: p.lat!, lng: p.lng!, name: p.name));
      } else {
        try {
          final data = await widget.repo.placeSearch(p.name);
          final resLng = double.tryParse(data["x"]?.toString() ?? "");
          final resLat = double.tryParse(data["y"]?.toString() ?? "");
          if (resLng != null && resLat != null) {
            resolved.add((lat: resLat, lng: resLng, name: p.name));
          }
        } catch (_) {}
      }
    }
    if (!mounted) return;
    if (resolved.isEmpty) {
      setState(() { _status = "error"; _errorMsg = "장소 좌표를 모두 찾을 수 없습니다."; });
      return;
    }
    _resolvedPlaces = resolved;

    DirectionsRouteDto? dto;
    if (resolved.length >= 2) {
      dto = await _fetchCarDirectionsForPlaces(widget.repo, resolved);
    }
    if (!mounted) return;
    if (dto != null) {
      _carRoutePoints =
          dto.pathLngLat.map((p) => NLatLng(p.$2, p.$1)).toList();
      _routeDistanceM = dto.distanceM;
      _routeDurationMs = dto.durationMs;
    } else {
      _carRoutePoints = null;
      _routeDistanceM = null;
      _routeDurationMs = null;
    }

    setState(() => _status = "ok");
  }

  /// 차량·도보 요약 (대중교통은 웹과 같이 배너 생략)
  String? _routeSummaryLine() {
    if (_resolvedPlaces.length < 2) return null;
    if (_mode == _RouteTransportMode.transit) return null;
    final straight = _totalStraightDistanceM(_resolvedPlaces);
    if (_mode == _RouteTransportMode.car) {
      if (_routeDistanceM != null && _routeDistanceM! > 0) {
        final km = (_routeDistanceM! / 1000).toStringAsFixed(1);
        final min = ((_routeDurationMs ?? 0) / 60000).ceil();
        return "약 $km km · 차량 약 $min분";
      }
      final d = (straight * 1.3).round();
      final tMs = ((straight * 1.3) / 400 * 60000).round();
      final km = (d / 1000).toStringAsFixed(1);
      final min = (tMs / 60000).ceil();
      return "약 $km km · 차량 약 $min분 (추정)";
    }
    // walk
    final d = (straight * 1.2).round();
    final tMs = ((straight * 1.2) / 80 * 60000).round();
    final km = (d / 1000).toStringAsFixed(1);
    final min = (tMs / 60000).ceil();
    return "약 $km km · 도보 약 $min분 (추정)";
  }

  Widget _transportModeBar() {
    final modes = _RouteTransportMode.values;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      child: Row(
        children: [
          for (var i = 0; i < modes.length; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(
              child: _RouteModeChip(
                mode: modes[i],
                selected: _mode == modes[i],
                onTap: () => setState(() => _mode = modes[i]),
              ),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.all(16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 헤더
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)]),
              ),
              child: Row(
                children: [
                  const Text("🗺️", style: TextStyle(fontSize: 18)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.planName,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            if (_status != "loading" && _resolvedPlaces.isNotEmpty)
              DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border(bottom: BorderSide(color: Colors.grey.shade100)),
                ),
                child: _transportModeBar(),
              ),
            // 지도 (있을 때만)
            if (_status == "loading")
              const SizedBox(
                height: 200,
                child: Center(child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(),
                    SizedBox(height: 8),
                    Text("경로를 불러오는 중…", style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                )),
              )
            else if (_resolvedPlaces.isNotEmpty)
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: double.infinity,
                    height: 260,
                    child: _buildDynamicRouteMap(context),
                  ),
                  if (_routeSummaryLine() != null)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                      color: _mode.accent,
                      child: Text(
                        _routeSummaryLine()!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    ),
                ],
              )
            else if (_status == "ok" && _errorMsg.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Text(
                  "지도 로드 실패: $_errorMsg",
                  style: const TextStyle(fontSize: 11, color: Color(0xFFEF4444)),
                  textAlign: TextAlign.center,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            // 장소 목록
            if (_status != "loading" && _resolvedPlaces.isNotEmpty)
              Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
                constraints: const BoxConstraints(maxHeight: 180),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text("경유 장소", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey)),
                    const SizedBox(height: 6),
                    Flexible(
                      child: ListView.separated(
                        shrinkWrap: true,
                        itemCount: _resolvedPlaces.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 4),
                        itemBuilder: (_, i) {
                          const dotColors = [Color(0xFF1E88E5), Color(0xFF8E24AA), Color(0xFFD81B60), Color(0xFFF57C00), Color(0xFF43A047)];
                          final isTransit = _mode == _RouteTransportMode.transit;
                          final segmentUrl = isTransit && i > 0
                              ? _naverTransitSegmentUrl(_resolvedPlaces, i)
                              : null;
                          return Row(
                            children: [
                              Container(
                                width: 20, height: 20,
                                decoration: BoxDecoration(color: dotColors[i % dotColors.length], shape: BoxShape.circle),
                                alignment: Alignment.center,
                                child: Text("${i + 1}", style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                              ),
                              const SizedBox(width: 8),
                              Expanded(child: Text(_resolvedPlaces[i].name, style: const TextStyle(fontSize: 12, color: Color(0xFF374151)), overflow: TextOverflow.ellipsis)),
                              TextButton(
                                onPressed: () async {
                                  final uri = segmentUrl != null
                                      ? Uri.parse(segmentUrl)
                                      : Uri.parse(
                                          "https://map.naver.com/p/search/${Uri.encodeComponent(_resolvedPlaces[i].name)}");
                                  try {
                                    await launchUrl(uri, mode: LaunchMode.externalApplication);
                                  } catch (_) {}
                                },
                                style: TextButton.styleFrom(
                                  foregroundColor: isTransit && segmentUrl != null
                                      ? const Color(0xFF0284C7)
                                      : const Color(0xFF6B7280),
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  minimumSize: Size.zero,
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: Text(
                                  isTransit && segmentUrl != null ? "$i→${i + 1} 경로" : "지도 보기",
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            // 하단 버튼
            if (_status != "loading")
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 12),
                child: SizedBox(
                  width: double.infinity,
                  child: TextButton.icon(
                    onPressed: () async {
                      if (_resolvedPlaces.isEmpty) return;
                      final first = _resolvedPlaces.first;
                      final uri = Uri.parse("https://map.naver.com/p/search/${Uri.encodeComponent(first.name)}");
                      try { await launchUrl(uri, mode: LaunchMode.externalApplication); } catch (_) {}
                    },
                    icon: const Icon(Icons.open_in_new, size: 14),
                    label: const Text("네이버 지도에서 경로 보기"),
                    style: TextButton.styleFrom(foregroundColor: const Color(0xFF6366F1), textStyle: const TextStyle(fontSize: 12)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildDynamicRouteMap(BuildContext context) {
    final safePadding = MediaQuery.paddingOf(context);
    final targets = _resolvedPlaces.map((p) => NLatLng(p.lat, p.lng)).toList();
    final initial = targets.first;
    final carRoad = _carRoutePoints;
    final mode = _mode;

    return NaverMap(
      key: ValueKey(mode),
      options: NaverMapViewOptions(
        contentPadding: safePadding,
        initialCameraPosition: NCameraPosition(target: initial, zoom: 13),
        indoorEnable: true,
        locationButtonEnable: false,
        logoClickEnable: false,
      ),
      onMapReady: (controller) async {
        final overlays = <NAddableOverlay>{};
        for (var i = 0; i < _resolvedPlaces.length; i++) {
          final p = _resolvedPlaces[i];
          overlays.add(
            NMarker(
              id: "p$i",
              position: NLatLng(p.lat, p.lng),
              caption: NOverlayCaption(text: "${i + 1}. ${p.name}"),
            ),
          );
        }

        if (targets.length >= 2) {
          late final List<NLatLng> lineCoords;
          late final Color stroke;
          late final double strokeWidth;
          late final List<int> pattern;

          switch (mode) {
            case _RouteTransportMode.car:
              final hasRoad = carRoad != null && carRoad.length >= 2;
              lineCoords = hasRoad ? carRoad : targets;
              stroke = const Color(0xFF6366F1);
              strokeWidth = hasRoad ? 5 : 3;
              pattern = hasRoad ? const [] : const [6, 6];
            case _RouteTransportMode.walk:
              lineCoords = targets;
              stroke = const Color(0xFF10B981);
              strokeWidth = 4;
              pattern = const [6, 6];
            case _RouteTransportMode.transit:
              lineCoords = targets;
              stroke = const Color(0x800EA5E9);
              strokeWidth = 3;
              pattern = const [6, 6];
          }

          overlays.add(
            NPolylineOverlay(
              id: "route",
              coords: lineCoords,
              color: stroke,
              width: strokeWidth,
              pattern: pattern,
            ),
          );
        }

        await controller.addOverlayAll(overlays);

        if (targets.length >= 2) {
          final boundsPoints = <NLatLng>[...targets];
          if (mode == _RouteTransportMode.car) {
            final r = carRoad;
            if (r != null && r.length >= 2) {
              boundsPoints.addAll(r);
            }
          }
          final bounds = NLatLngBounds.from(boundsPoints);
          await controller.updateCamera(
            NCameraUpdate.fitBounds(bounds, padding: const EdgeInsets.all(42)),
          );
        } else {
          await controller.updateCamera(
            NCameraUpdate.scrollAndZoomTo(target: targets.first, zoom: 15),
          );
        }
      },
    );
  }
}

class _RouteModeChip extends StatelessWidget {
  const _RouteModeChip({
    required this.mode,
    required this.selected,
    required this.onTap,
  });
  final _RouteTransportMode mode;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = mode.accent;
    return Material(
      color: selected ? accent : const Color(0xFFF3F4F6),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(mode.emoji, style: const TextStyle(fontSize: 13)),
              const SizedBox(width: 4),
              Text(
                mode.label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: selected ? Colors.white : const Color(0xFF6B7280),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── 줌 버튼 ──────────────────────────────────────────────────
class _ZoomBtn extends StatelessWidget {
  const _ZoomBtn({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32, height: 32,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 4)],
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Icon(icon, size: 16, color: const Color(0xFF374151)),
      ),
    );
  }
}
