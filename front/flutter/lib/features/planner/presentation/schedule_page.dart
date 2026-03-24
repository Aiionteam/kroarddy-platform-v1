import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/auth/jwt_claims.dart";
import "../../../core/router/main_shell.dart";
import "../../auth/presentation/state/auth_controller.dart";
import "../data/planner_models.dart";
import "../data/planner_repository.dart";

const _purple = Color(0xFF7C3AED);
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _bgPage = Color(0xFFF8F7FF);
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
                                                fontSize: 18,
                                              ),
                                            ),
                                          ),
                                          if ((item.estimatedCost ?? "").isNotEmpty)
                                            Text(
                                              item.estimatedCost!,
                                              style: const TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w700,
                                                color: Color(0xFF059669),
                                              ),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        "📍 ${item.place}",
                                        style: TextStyle(color: palette.text.withValues(alpha: 0.85), fontSize: 13),
                                      ),
                                      if (item.description.isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          item.description,
                                          style: TextStyle(
                                            color: palette.text.withValues(alpha: 0.8),
                                            fontSize: 13,
                                            height: 1.35,
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
                                            style: const TextStyle(
                                              fontSize: 12,
                                              color: Color(0xFF92400E),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                IconButton(
                                  tooltip: "이 항목 리롤",
                                  onPressed:
                                      _rerollingKey == "${p.id}:${e.key}" ? null : () => _rerollItem(p, e.key),
                                  icon: _rerollingKey == "${p.id}:${e.key}"
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(strokeWidth: 2),
                                        )
                                      : const Icon(Icons.refresh, size: 30),
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
