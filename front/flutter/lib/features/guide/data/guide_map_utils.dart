import "guide_answer_sanitize.dart";
import "guide_models.dart";

/// 웹 `parsePlaceLatLng` 대응
({double lat, double lng})? parsePlaceLatLng(double? lat, double? lng) {
  if (lat == null || lng == null) return null;
  if (!lat.isFinite || !lng.isFinite) return null;
  if (lat.abs() > 90 || lng.abs() > 180) return null;
  if (lat == 0 && lng == 0) return null;
  return (lat: lat, lng: lng);
}

double parseFestivalCoord(Object? v) {
  if (v == null) return double.nan;
  if (v is num) return v.toDouble();
  final s = v.toString().trim().replaceAll(",", ".");
  if (s.isEmpty) return double.nan;
  return double.tryParse(s) ?? double.nan;
}

/// 웹 `normalizeFestivalLatLng`
({double lat, double lng}) normalizeFestivalLatLng(double lat, double lng) {
  if (!lat.isFinite || !lng.isFinite) return (lat: lat, lng: lng);
  if (lat.abs() > 90 && lng.abs() <= 90 && lng.abs() >= 1) {
    return (lat: lng, lng: lat);
  }
  return (lat: lat, lng: lng);
}

String _festIdSuffix(String name, int i) {
  final t = name.trim();
  if (t.length <= 20) return t.isEmpty ? "$i" : t;
  return t.substring(0, 20);
}

List<GuideMapMarker> festivalItemsToMarkers(List<FestivalItem> items) {
  final out = <GuideMapMarker>[];
  for (var i = 0; i < items.length; i++) {
    final it = items[i];
    var lat = parseFestivalCoord(it.latitude);
    var lng = parseFestivalCoord(it.longitude);
    final n = normalizeFestivalLatLng(lat, lng);
    lat = n.lat;
    lng = n.lng;
    if (!lat.isFinite || !lng.isFinite) continue;
    if (lat == 0 && lng == 0) continue;
    final r = it.rdnmadr.trim();
    final l = (it.lnmadr ?? "").trim();
    final addr = r.isNotEmpty ? r : (l.isNotEmpty ? l : "");
    final useAddr = addr.isNotEmpty ? addr : it.opar;
    out.add(
      GuideMapMarker(
        id: "fest-$i-${_festIdSuffix(it.fstvlNm, i)}",
        lat: lat,
        lng: lng,
        title: it.fstvlNm.isNotEmpty ? it.fstvlNm : "행사",
        kind: GuideMarkerKind.festival,
        address: useAddr,
        category: "행사",
        description: it.fstvlCo.isNotEmpty ? it.fstvlCo : (it.relateInfo ?? ""),
        fstvlStartDate: it.fstvlStartDate,
        fstvlEndDate: it.fstvlEndDate,
        opar: it.opar,
        homepageUrl: it.homepageUrl,
      ),
    );
  }
  return out;
}

List<GuideMapMarker> guidePlacesToMarkers(List<GuidePlaceMarkerDto> places) {
  final out = <GuideMapMarker>[];
  for (var i = 0; i < places.length; i++) {
    final p = places[i];
    final ll = parsePlaceLatLng(p.lat, p.lng);
    if (ll == null) continue;
    final name = p.name.trim().isNotEmpty ? p.name.trim() : "장소";
    out.add(
      GuideMapMarker(
        id: "place-$i-$name-${ll.lat.toStringAsFixed(5)}-${ll.lng.toStringAsFixed(5)}",
        lat: ll.lat,
        lng: ll.lng,
        title: name,
        kind: GuideMarkerKind.place,
        address: p.address,
        category: p.category,
        description: p.description,
        summary: p.summary,
        tip: p.tip,
        imageUrl: p.imageUrl,
        photoSpot: p.photoSpot,
        estimatedCost: p.estimatedCost,
        visitDuration: p.duration,
        keywords: p.keywords,
        recommendationPoints: p.points,
      ),
    );
  }
  return out;
}

String extractPlaceSectionFromAnswer(String answer, String placeName) {
  final a = stripPlacesJsonBlock(answer);
  final name = placeName.trim();
  if (a.isEmpty || name.isEmpty) return "";

  try {
    final afterBold = RegExp(
      r"\*\*\s*" + RegExp.escape(name) + r"\s*\*\*\s*([\s\S]*?)(?=\n\s*\*\*[^*]+\*\*|<<<PLACES_JSON>>>|$)",
      caseSensitive: false,
    );
    final m1 = afterBold.firstMatch(a);
    if (m1 != null) {
      final chunk = m1.group(1)?.trim() ?? "";
      if (chunk.length >= 8) return chunk;
    }
  } catch (_) {}

  for (final p in a.split(RegExp(r"\n\n+"))) {
    final t = p.trim();
    if (t.contains("<<<PLACES_JSON>>>")) continue;
    if (t.length < 24) continue;
    if (t.contains(name)) return t;
  }
  return "";
}
