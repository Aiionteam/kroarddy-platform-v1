import "package:easy_localization/easy_localization.dart";

/// Web `planner.standard.dest` synced as JSON root `planner_dest.{slug}.name|highlightN`.
String plannerDestName(String slug) {
  final k = "planner_dest.$slug.name";
  final t = k.tr();
  if (t == k) return slug;
  return t;
}

/// Highlight lines for cards / search (up to 5 if present in locale).
List<String> plannerDestHighlights(String slug) {
  final out = <String>[];
  for (var i = 1; i <= 5; i++) {
    final k = "planner_dest.$slug.highlight$i";
    final t = k.tr();
    if (t != k && t.isNotEmpty) out.add(t);
  }
  return out;
}

String plannerDestHighlightsLine(String slug, {int maxItems = 3}) {
  final h = plannerDestHighlights(slug);
  if (h.isEmpty) return "";
  return h.take(maxItems).join(" · ");
}

/// Web `planner.standard.region` → `planner_region.{key}` with `-` → `_`.
String plannerRegionLabel(String regionKey) {
  final k = "planner_region.$regionKey.label";
  final t = k.tr();
  if (t == k) return regionKey;
  return t;
}

String plannerRegionSubLabel(String regionKey) {
  final k = "planner_region.$regionKey.subLabel";
  final t = k.tr();
  if (t == k) return "";
  return t;
}

bool plannerDestMatchesQuery(String slug, String query) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return false;
  if (slug.toLowerCase().contains(q)) return true;
  if (plannerDestName(slug).toLowerCase().contains(q)) return true;
  for (final h in plannerDestHighlights(slug)) {
    if (h.toLowerCase().contains(q)) return true;
  }
  return false;
}
