import "package:flutter/foundation.dart";

/// 웹 `[packageId]/page.tsx` 의 `parseResponse` 와 동일한 매핑.
@immutable
class KContentParsedGenerate {
  const KContentParsedGenerate({
    required this.packageMeta,
    required this.schedule,
    required this.costSummary,
  });

  final Map<String, dynamic>? packageMeta;
  final List<Map<String, dynamic>> schedule;
  final Map<String, dynamic>? costSummary;
}

Map<String, dynamic>? _packageMetaFromRaw(Map<String, dynamic> metaRaw) {
  if (metaRaw.isEmpty) return null;
  return {
    if (metaRaw["package_id"] != null) "package_id": metaRaw["package_id"].toString(),
    if (metaRaw["category"] is String) "category": metaRaw["category"],
    if (metaRaw["title_ko"] is String) "title_ko": metaRaw["title_ko"],
    if (metaRaw["title_en"] is String) "title_en": metaRaw["title_en"],
    if (metaRaw["tags"] is String) "tags": metaRaw["tags"],
  };
}

DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

/// `startDateIso` = `YYYY-MM-DD`
KContentParsedGenerate parseKContentGenerateResponse({
  required Map<String, dynamic> res,
  required String startDateIso,
  required String fallbackScheduleTitlePrefix,
}) {
  final metaRaw = (res["package_meta"] is Map) ? Map<String, dynamic>.from(res["package_meta"] as Map) : <String, dynamic>{};
  final packageMeta = _packageMetaFromRaw(metaRaw);

  final placesRaw = (res["places"] is List) ? res["places"] as List : const [];
  final sourceByName = <String, String>{};
  for (final p in placesRaw) {
    if (p is! Map) continue;
    final row = Map<String, dynamic>.from(p);
    final src = row["source"] == "db" ? "db" : "external";
    final ko = row["name_ko"]?.toString() ?? "";
    final en = row["name_en"]?.toString() ?? "";
    if (ko.isNotEmpty) sourceByName[ko] = src;
    if (en.isNotEmpty) sourceByName[en] = src;
  }

  final itemsRaw = (res["schedule"] is List) ? res["schedule"] as List : const [];
  final start = DateTime.tryParse(startDateIso);
  final base = start != null ? _dateOnly(start) : _dateOnly(DateTime.now());

  final schedule = <Map<String, dynamic>>[];
  for (var idx = 0; idx < itemsRaw.length; idx++) {
    final item = itemsRaw[idx];
    if (item is! Map) continue;
    final row = Map<String, dynamic>.from(item);
    final dayNum = row["day"] is num ? (row["day"] as num).toInt() : int.tryParse(row["day"]?.toString() ?? "") ?? 1;
    final d = base.add(Duration(days: dayNum - 1));
    final date =
        "${d.year.toString().padLeft(4, "0")}-${d.month.toString().padLeft(2, "0")}-${d.day.toString().padLeft(2, "0")}";
    final place = row["place"]?.toString() ?? "";
    final orderRaw = row["order"];
    int? order;
    if (orderRaw is num) {
      order = orderRaw.toInt();
    } else if (orderRaw != null && orderRaw.toString().trim().isNotEmpty) {
      order = int.tryParse(orderRaw.toString());
    }

    final entry = <String, dynamic>{
      "day": dayNum,
      "date": date,
      if (row["time"] != null && row["time"].toString().isNotEmpty) "time": row["time"].toString(),
      "place": place,
      "title": row["title"]?.toString().isNotEmpty == true
          ? row["title"].toString()
          : "$fallbackScheduleTitlePrefix ${idx + 1}",
      "description": row["description"]?.toString() ?? "",
      if (row["tips"] != null && row["tips"].toString().isNotEmpty) "tips": row["tips"].toString(),
      if (row["estimated_cost"] != null && row["estimated_cost"].toString().isNotEmpty)
        "estimated_cost": row["estimated_cost"].toString(),
      "source": sourceByName[place] ?? "external",
      if (row["is_twist"] == true) "is_twist": true,
      if (row["vibe_reason"] != null && row["vibe_reason"].toString().isNotEmpty)
        "vibe_reason": row["vibe_reason"].toString(),
    };
    if (order != null) {
      entry["order"] = order;
    }
    schedule.add(entry);
  }

  final costRaw = res["cost_summary"];
  Map<String, dynamic>? costSummary;
  if (costRaw is Map) {
    final cr = Map<String, dynamic>.from(costRaw);
    final perDayRaw = cr["per_day"];
    final perDay = <Map<String, dynamic>>[];
    if (perDayRaw is List) {
      for (final e in perDayRaw) {
        if (e is! Map) continue;
        final d = Map<String, dynamic>.from(e);
        final day = d["day"] is num ? (d["day"] as num).toInt() : int.tryParse(d["day"]?.toString() ?? "") ?? 0;
        final total = d["total"]?.toString() ?? "";
        if (day > 0 && total.isNotEmpty) {
          perDay.add({"day": day, "total": total});
        }
      }
    }
    final tripTotal = cr["trip_total"]?.toString() ?? "";
    if (perDay.isNotEmpty || tripTotal.isNotEmpty) {
      costSummary = {
        "per_day": perDay,
        "trip_total": tripTotal,
      };
    }
  }

  return KContentParsedGenerate(
    packageMeta: packageMeta,
    schedule: schedule,
    costSummary: costSummary,
  );
}
