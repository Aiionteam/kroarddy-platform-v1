import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";

import "../../../../core/theme/kroaddy_colors.dart";

const _kPurpleLight = KroaddyColors.brandWash;
const _kPurple = KroaddyColors.primary;
const _kGray500 = Color(0xFF6B7280);
const _kGray700 = Color(0xFF374151);
const _kGray800 = Color(0xFF1F2937);

/// 게시글에 저장된 `attached_schedule` JSON 맵을 일정표 형태로 표시한다.
class TourstarAttachedSchedulePreview extends StatelessWidget {
  const TourstarAttachedSchedulePreview({super.key, required this.data});

  final Map<String, dynamic> data;

  List<MapEntry<int, List<Map<String, dynamic>>>> _byDay() {
    final raw = data["schedule"];
    if (raw is! List) return [];
    final byDay = <int, List<Map<String, dynamic>>>{};
    for (final item in raw) {
      if (item is! Map) continue;
      final m = Map<String, dynamic>.from(item);
      final d = (m["day"] as num?)?.toInt() ?? 1;
      byDay.putIfAbsent(d, () => []).add(m);
    }
    final keys = byDay.keys.toList()..sort();
    return keys.map((k) => MapEntry(k, byDay[k]!)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final route = data["route_name"]?.toString() ?? "";
    final loc = data["location"]?.toString() ?? "";
    final start = data["start_date"]?.toString();
    final end = data["end_date"]?.toString();
    final dateParts = <String>[];
    if (start != null && start.isNotEmpty) dateParts.add(start);
    if (end != null && end.isNotEmpty) dateParts.add(end);
    final dateLine = dateParts.join(" ~ ");
    final grouped = _byDay();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _kPurpleLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFD8B4FE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.calendar_month_outlined, size: 18, color: _kPurple),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  "screens.tourstar.schedule_section_title".tr(),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: _kGray800,
                  ),
                ),
              ),
            ],
          ),
          if (route.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(route, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _kGray800)),
          ],
          if (loc.isNotEmpty || dateLine.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              [loc, dateLine].where((s) => s.isNotEmpty).join(" · "),
              style: const TextStyle(fontSize: 12, color: _kGray500),
            ),
          ],
          if (grouped.isNotEmpty) ...[
            const SizedBox(height: 10),
            ...grouped.map((e) {
              final day = e.key;
              final stops = e.value;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "screens.tourstar.schedule_day_n".tr(namedArgs: {"n": "$day"}),
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _kPurple),
                    ),
                    const SizedBox(height: 6),
                    ...stops.map((s) {
                      final place = s["place"]?.toString() ?? "";
                      final time = s["time"]?.toString() ?? "";
                      final title = s["title"]?.toString() ?? "";
                      final line = [time, place].where((x) => x.isNotEmpty).join(" · ");
                      final sub = title.isNotEmpty && title != place ? title : "";
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text("• ", style: TextStyle(color: _kGray500)),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (line.isNotEmpty)
                                    Text(line, style: const TextStyle(fontSize: 12, color: _kGray700, height: 1.35)),
                                  if (sub.isNotEmpty)
                                    Text(sub, style: const TextStyle(fontSize: 11, color: _kGray500, height: 1.3)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}
