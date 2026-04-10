part of "schedule_page.dart";

/// 웹 `PlanCard` — 저장 플랜 카드 + 여행 기간 날씨(첫 일정 좌표 기준)
class _SchedulePlanTile extends ConsumerStatefulWidget {
  const _SchedulePlanTile({
    required this.plan,
    required this.palette,
    required this.dotColor,
    required this.modifyingPlanId,
    required this.deletingPlanId,
    required this.rerollingKey,
    required this.onModify,
    required this.onDelete,
    required this.onReroll,
  });

  final TravelPlanRecord plan;
  final _PlanPalette palette;
  final Color dotColor;
  final int? modifyingPlanId;
  final int? deletingPlanId;
  final String? rerollingKey;
  final VoidCallback onModify;
  final VoidCallback onDelete;
  final void Function(int flatIdx) onReroll;

  @override
  ConsumerState<_SchedulePlanTile> createState() => _SchedulePlanTileState();
}

class _SchedulePlanTileState extends ConsumerState<_SchedulePlanTile> {
  Map<String, WeatherDay> _planWeather = {};
  bool _weatherLoading = false;
  /// ExpansionTile/ListTile 대신 직접 접기 — 좁은 화면에서 헤더 Row 오버플로우 방지
  bool _planExpanded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadWeather());
  }

  @override
  void didUpdateWidget(covariant _SchedulePlanTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.plan.id != widget.plan.id ||
        oldWidget.plan.startDate != widget.plan.startDate ||
        oldWidget.plan.endDate != widget.plan.endDate ||
        oldWidget.plan.schedule.length != widget.plan.schedule.length) {
      _loadWeather();
    }
  }

  Future<void> _loadWeather() async {
    final plan = widget.plan;
    if (!_shouldLoadTripWeather(plan)) return;
    ScheduleItem? first;
    for (final s in plan.schedule) {
      final la = s.lat;
      final ln = s.lng;
      if (la != null && ln != null && la != 0 && ln != 0) {
        first = s;
        break;
      }
    }
    if (first == null) return;

    final start = plan.startDate?.trim() ?? "";
    if (start.isEmpty) return;
    final endRaw = plan.endDate?.trim();
    final end = (endRaw == null || endRaw.isEmpty) ? start : endRaw;

    if (!mounted) return;
    setState(() => _weatherLoading = true);
    try {
      final repo = ref.read(plannerRepositoryProvider);
      final res = await repo.fetchWeather(
        startDate: start,
        endDate: end,
        lat: first.lat!,
        lon: first.lng!,
      );
      if (!mounted) return;
      if (res.available && res.dates.isNotEmpty) {
        setState(() => _planWeather = res.dates);
      } else {
        setState(() => _planWeather = {});
      }
    } finally {
      if (mounted) setState(() => _weatherLoading = false);
    }
  }

  Widget _weatherStrip() {
    if (_weatherLoading) {
      return Row(
        children: [
          const SizedBox(
            width: 12,
            height: 12,
            child: CircularProgressIndicator(strokeWidth: 2, color: _purple),
          ),
          const SizedBox(width: 6),
          Text(
            "common.loading".tr(),
            style: TextStyle(fontSize: 10, color: Colors.grey.shade400),
          ),
        ],
      );
    }
    if (_planWeather.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: _planWeather.entries.map((e) {
        final w = e.value;
        return Tooltip(
          message: w.advice.isNotEmpty ? w.advice : w.condition,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFE0F2FE),
              border: Border.all(color: const Color(0xFFBAE6FD)),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_weatherEmojiFromCondition(w.condition)),
                const SizedBox(width: 4),
                Text(
                  _weatherMdLabel(e.key),
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0369A1),
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  "${w.tempMin}°/${w.tempMax}°C",
                  style: const TextStyle(fontSize: 10, color: Color(0xFF0369A1)),
                ),
                if (w.pop > 0) ...[
                  Text(
                    " 💧${w.pop.round()}%",
                    style: const TextStyle(fontSize: 10, color: Color(0xFF38BDF8)),
                  ),
                ],
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget? _dayInlineWeather(String dayDate) {
    if (dayDate.isEmpty) return null;
    final w = _planWeather[dayDate];
    if (w == null) return null;
    return Container(
      margin: const EdgeInsets.only(left: 6),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFE0F2FE),
        border: Border.all(color: const Color(0xFFBAE6FD)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(_weatherEmojiFromCondition(w.condition)),
          const SizedBox(width: 4),
          Text(
            "${w.tempMin}°/${w.tempMax}°C",
            style: const TextStyle(fontSize: 10, color: Color(0xFF0284C7)),
          ),
          if (w.pop > 0)
            Text(
              " 💧${w.pop.round()}%",
              style: const TextStyle(fontSize: 10, color: Color(0xFF38BDF8)),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.plan;
    final palette = widget.palette;

    return Container(
      key: PageStorageKey<String>("plan-tile-${p.id}"),
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
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Material(
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 10, 4, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  InkWell(
                    onTap: () => setState(() => _planExpanded = !_planExpanded),
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: CircleAvatar(
                        radius: 8,
                        backgroundColor: widget.dotColor,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: InkWell(
                      onTap: () => setState(() => _planExpanded = !_planExpanded),
                      borderRadius: BorderRadius.circular(8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            "${p.location} · ${p.routeName}",
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontWeight: FontWeight.w700, color: palette.text),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "${p.startDate ?? "-"} ~ ${p.endDate ?? "-"}",
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 12, color: palette.text.withValues(alpha: 0.75)),
                          ),
                          if (_weatherLoading || _planWeather.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Wrap(
                              crossAxisAlignment: WrapCrossAlignment.center,
                              spacing: 8,
                              runSpacing: 4,
                              children: [
                                Text(
                                  "screens.schedule.weather_forecast".tr(),
                                  style: const TextStyle(fontSize: 10, color: _textSecondary),
                                ),
                                Text(
                                  "screens.schedule.weather_within_5days".tr(),
                                  style: TextStyle(fontSize: 10, color: Colors.grey.shade400),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            _weatherStrip(),
                          ],
                        ],
                      ),
                    ),
                  ),
                  Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: "전체 경로 보기",
                          padding: const EdgeInsets.all(2),
                          visualDensity: VisualDensity.compact,
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                          onPressed: () {
                            final places = p.schedule
                                .where((s) => s.place.trim().isNotEmpty)
                                .map(
                                  (s) => (
                                    name: s.place,
                                    lat: s.lat,
                                    lng: s.lng,
                                  ),
                                )
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
                          padding: const EdgeInsets.all(2),
                          visualDensity: VisualDensity.compact,
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                          onPressed: widget.modifyingPlanId == p.id ? null : widget.onModify,
                          icon: widget.modifyingPlanId == p.id
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : Icon(Icons.auto_fix_high, color: palette.text, size: 20),
                        ),
                        IconButton(
                          tooltip: "삭제",
                          padding: const EdgeInsets.all(2),
                          visualDensity: VisualDensity.compact,
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                          onPressed: widget.deletingPlanId == p.id ? null : widget.onDelete,
                          icon: widget.deletingPlanId == p.id
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : Icon(Icons.delete_outline, color: palette.text, size: 20),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(left: 2),
                          child: Icon(
                            _planExpanded ? Icons.expand_less : Icons.expand_more,
                            color: palette.text,
                            size: 22,
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
          if (_planExpanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ...(() {
            final grouped = <int, List<MapEntry<int, ScheduleItem>>>{};
            for (final entry in p.schedule.asMap().entries) {
              grouped.putIfAbsent(entry.value.day, () => <MapEntry<int, ScheduleItem>>[]).add(entry);
            }
            final dayEntries = grouped.entries.toList()..sort((a, b) => a.key.compareTo(b.key));

            return dayEntries.expand((dayEntry) {
              final day = dayEntry.key;
              final items = dayEntry.value;
              final dayDate = items.first.value.date;
              return <Widget>[
                Padding(
                  padding: const EdgeInsets.fromLTRB(6, 10, 6, 6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
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
                          Expanded(
                            child: Text(
                              dayDate.isEmpty ? "Day $day" : dayDate,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: palette.text,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (_dayInlineWeather(dayDate) != null)
                        Padding(
                          padding: const EdgeInsets.only(left: 24, top: 6),
                          child: _dayInlineWeather(dayDate)!,
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
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
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
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: palette.text.withValues(alpha: 0.9),
                                          fontSize: 12,
                                          decoration: TextDecoration.underline,
                                          decorationColor: palette.text.withValues(alpha: 0.4),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 4),
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
                          onPressed: widget.rerollingKey == "${p.id}:${e.key}"
                              ? null
                              : () => widget.onReroll(e.key),
                          icon: widget.rerollingKey == "${p.id}:${e.key}"
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
            ),
        ],
      ),
    );
  }
}
