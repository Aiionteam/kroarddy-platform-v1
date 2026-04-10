// Mirrors `[packageId]/page.tsx` — localizeTip / normalizeDescription / getLocalizedDescription

int _countHangul(String text) => RegExp(r"[가-힣]").allMatches(text).length;
int _countLatin(String text) => RegExp(r"[A-Za-z]").allMatches(text).length;

bool looksKorean(String text) => _countHangul(text) > _countLatin(text);
bool looksEnglish(String text) => _countLatin(text) > _countHangul(text);

List<String> _splitMixedSegments(String text) {
  final cleaned = text.replaceAll(RegExp(r"\s+"), " ").trim();
  if (cleaned.isEmpty) return [];
  return cleaned
      .split(RegExp(r"\n+|\s+\|\s+|\s+/\s+| · |\.\s+(?=[A-Z가-힣])"))
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty)
      .toList();
}

String localizeTip(String? raw, String lang) {
  final text = (raw ?? "").trim();
  if (text.isEmpty) return "";
  final hasKo = _countHangul(text) > 0;
  final hasEn = _countLatin(text) > 0;
  if (!(hasKo && hasEn)) return text;

  final segments = _splitMixedSegments(text);
  if (segments.length > 1) {
    final sorted = [...segments]..sort((a, b) {
        final aScore = lang == "ko" ? _countHangul(a) : _countLatin(a);
        final bScore = lang == "ko" ? _countHangul(b) : _countLatin(b);
        return bScore.compareTo(aScore);
      });
    if (sorted.isNotEmpty) return sorted.first;
  }

  if (lang == "ko") {
    return text.replaceAll(RegExp(r"\([^)]*[A-Za-z][^)]*\)"), "").trim();
  }
  return text.replaceAll(RegExp(r"\([^)]*[가-힣][^)]*\)"), "").trim();
}

String normalizeDescription(String? raw, String lang) {
  final text = (raw ?? "").trim();
  if (text.isEmpty) return "";

  var cleaned = text
      .replaceAll(RegExp(r"\(description_en\)", caseSensitive: false), "")
      .replaceAll(RegExp(r"description_en\s*:\s*", caseSensitive: false), "")
      .replaceAll(RegExp(r"must_do_en\s*:\s*", caseSensitive: false), "|")
      .replaceAll(RegExp(r"\s+"), " ")
      .trim();

  final segments = _splitMixedSegments(cleaned);
  if (segments.isEmpty) return cleaned;

  final byLang = segments.where((s) => lang == "ko" ? looksKorean(s) : looksEnglish(s)).toList();
  if (byLang.isNotEmpty) return byLang.first;
  return segments.first;
}

String getLocalizedDescription({
  required String? description,
  required String? tips,
  required String place,
  String? source,
  required String lang,
  required String fallbackDescription,
}) {
  final normalized = normalizeDescription(description, lang);
  if (lang == "ko" && source == "db" && looksEnglish(normalized)) {
    final tipKo = localizeTip(tips, "ko");
    if (tipKo.isNotEmpty && looksKorean(tipKo)) return tipKo;
    return fallbackDescription;
  }
  return normalized;
}
