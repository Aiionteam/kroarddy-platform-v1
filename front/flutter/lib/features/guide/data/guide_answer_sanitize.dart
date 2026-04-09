import "dart:convert";

/// 웹 `sanitizeAnswer.ts`와 동일한 목적: 표시용 answer 정제.

String sanitizeGuideAnswerForDisplay(String raw) {
  var s = raw.trim();
  if (s.isEmpty) return "";

  final fence = RegExp(r"^```(?:json)?\s*([\s\S]*?)```\s*$", caseSensitive: false);
  final m = fence.firstMatch(s);
  if (m != null) {
    s = (m.group(1) ?? "").trim();
  }

  if ((s.startsWith("{") && s.contains("}")) ||
      (s.startsWith("[") && s.contains("]"))) {
    try {
      final parsed = jsonDecode(s);
      if (parsed is String) return parsed.trim();
      if (parsed is Map) {
        final inner = _extractFromRecord(Map<String, dynamic>.from(parsed));
        if (inner != null) return inner;
      }
    } catch (_) {}
  }
  return s;
}

String? _extractFromRecord(Map<String, dynamic> rec) {
  for (final key in ["text", "content", "message", "answer", "body"]) {
    final v = rec[key];
    if (v is String && v.trim().isNotEmpty) return v.trim();
  }
  final parts = rec["parts"];
  if (parts is List) {
    final chunks = <String>[];
    for (final p in parts) {
      if (p is Map && p["text"] is String) {
        final t = (p["text"] as String).trim();
        if (t.isNotEmpty) chunks.add(t);
      }
    }
    if (chunks.isNotEmpty) return chunks.join("\n");
  }
  return null;
}

String stripPlacesJsonBlock(String text) {
  final i = text.indexOf("<<<PLACES_JSON>>>");
  if (i >= 0) return text.substring(0, i).trim();
  return text.trim();
}
