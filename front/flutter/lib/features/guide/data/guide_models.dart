class FestivalItem {
  FestivalItem({
    required this.fstvlNm,
    required this.opar,
    required this.fstvlStartDate,
    required this.fstvlEndDate,
    required this.fstvlCo,
    required this.mnnstNm,
    required this.phoneNumber,
    required this.homepageUrl,
    required this.rdnmadr,
    this.relateInfo,
    this.lnmadr,
    this.latitude,
    this.longitude,
  });

  final String fstvlNm;
  final String opar;
  final String fstvlStartDate;
  final String fstvlEndDate;
  final String fstvlCo;
  final String mnnstNm;
  final String phoneNumber;
  final String homepageUrl;
  final String rdnmadr;
  final String? relateInfo;
  final String? lnmadr;
  /// API가 문자·숫자 혼용
  final Object? latitude;
  final Object? longitude;

  factory FestivalItem.fromJson(Map<String, dynamic> json) {
    return FestivalItem(
      fstvlNm: json["fstvlNm"]?.toString() ?? "",
      opar: json["opar"]?.toString() ?? "",
      fstvlStartDate: json["fstvlStartDate"]?.toString() ?? "",
      fstvlEndDate: json["fstvlEndDate"]?.toString() ?? "",
      fstvlCo: json["fstvlCo"]?.toString() ?? "",
      mnnstNm: json["mnnstNm"]?.toString() ?? "",
      phoneNumber: json["phoneNumber"]?.toString() ?? "",
      homepageUrl: json["homepageUrl"]?.toString() ?? "",
      rdnmadr: json["rdnmadr"]?.toString() ?? "",
      relateInfo: json["relateInfo"]?.toString(),
      lnmadr: json["lnmadr"]?.toString(),
      latitude: json["latitude"],
      longitude: json["longitude"],
    );
  }
}

class FestivalResponse {
  FestivalResponse({
    required this.year,
    required this.month,
    required this.items,
    required this.noData,
    required this.error,
  });

  final int year;
  final int month;
  final List<FestivalItem> items;
  final bool noData;
  final String? error;

  factory FestivalResponse.fromJson(Map<String, dynamic> json) {
    final rawItems = (json["items"] as List?) ?? const [];
    return FestivalResponse(
      year: (json["year"] as num?)?.toInt() ?? 0,
      month: (json["month"] as num?)?.toInt() ?? 0,
      items: rawItems
          .whereType<Map>()
          .map((e) => FestivalItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      noData: json["noData"] == true,
      error: json["error"]?.toString(),
    );
  }
}

class GuidePlaceRecommendationPoint {
  GuidePlaceRecommendationPoint({required this.icon, required this.text});

  final String icon;
  final String text;

  factory GuidePlaceRecommendationPoint.fromJson(Map<String, dynamic> json) {
    return GuidePlaceRecommendationPoint(
      icon: json["icon"]?.toString() ?? "",
      text: json["text"]?.toString() ?? "",
    );
  }
}

/// POST /v1/guide/ask — places[] 항목
class GuidePlaceMarkerDto {
  GuidePlaceMarkerDto({
    required this.name,
    required this.lat,
    required this.lng,
    required this.address,
    required this.description,
    required this.category,
    this.summary,
    this.points,
    this.tip,
    this.photoSpot,
    this.estimatedCost,
    this.duration,
    this.keywords,
    this.imageUrl,
  });

  final String name;
  final double? lat;
  final double? lng;
  final String address;
  final String description;
  final String category;
  final String? summary;
  final List<GuidePlaceRecommendationPoint>? points;
  final String? tip;
  final String? photoSpot;
  final String? estimatedCost;
  final String? duration;
  final List<String>? keywords;
  final String? imageUrl;

  factory GuidePlaceMarkerDto.fromJson(Map<String, dynamic> json) {
    List<GuidePlaceRecommendationPoint>? pts;
    final rawP = json["points"];
    if (rawP is List) {
      pts = rawP
          .whereType<Map>()
          .map((e) =>
              GuidePlaceRecommendationPoint.fromJson(Map<String, dynamic>.from(e)))
          .where((p) => p.text.trim().isNotEmpty)
          .take(3)
          .toList();
    }
    List<String>? kw;
    final rawK = json["keywords"];
    if (rawK is List) {
      kw = rawK
          .map((x) => x.toString().replaceFirst(RegExp(r"^#+"), "").trim())
          .where((s) => s.isNotEmpty)
          .map((s) => s.length > 32 ? s.substring(0, 32) : s)
          .take(3)
          .toList();
    }
    final ps = json["photo_spot"];
    final String? photoSpot = ps == null || ps == false
        ? null
        : () {
            final s = ps.toString().trim();
            if (s.isEmpty || s.toLowerCase() == "null") return null;
            return s;
          }();

    return GuidePlaceMarkerDto(
      name: json["name"]?.toString() ?? "",
      lat: _parseDouble(json["lat"]),
      lng: _parseDouble(json["lng"]),
      address: json["address"]?.toString() ?? "",
      description: json["description"]?.toString().trim() ?? "",
      category: json["category"]?.toString() ?? "",
      summary: _trimSlice(json["summary"]?.toString(), 40),
      points: pts?.isEmpty ?? true ? null : pts,
      tip: _trimSlice(json["tip"]?.toString(), 240),
      photoSpot: photoSpot,
      estimatedCost: json["estimated_cost"]?.toString().trim(),
      duration: json["duration"]?.toString().trim(),
      keywords: kw?.isEmpty ?? true ? null : kw,
      imageUrl: _nullIfEmpty(json["image_url"]?.toString()),
    );
  }
}

String? _trimSlice(String? raw, int maxLen) {
  final t = raw?.trim() ?? "";
  if (t.isEmpty) return "";
  return t.length <= maxLen ? t : t.substring(0, maxLen);
}

String? _nullIfEmpty(String? raw) {
  final t = raw?.trim() ?? "";
  return t.isEmpty ? null : t;
}

double? _parseDouble(Object? v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString().trim().replaceAll(",", "."));
}

class GuideAskResponse {
  GuideAskResponse({
    required this.answer,
    required this.source,
    required this.places,
  });

  final String answer;
  final String source;
  final List<GuidePlaceMarkerDto> places;

  factory GuideAskResponse.fromJson(Map<String, dynamic> json) {
    final rawPlaces = json["places"];
    final List<GuidePlaceMarkerDto> places;
    if (rawPlaces is List) {
      places = rawPlaces
          .whereType<Map>()
          .map((e) => GuidePlaceMarkerDto.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } else {
      places = const [];
    }
    return GuideAskResponse(
      answer: json["answer"]?.toString() ?? "",
      source: json["source"]?.toString() ?? "",
      places: places,
    );
  }
}

class GuideDirectionsResponse {
  GuideDirectionsResponse({
    required this.ok,
    required this.path,
    required this.distanceM,
    required this.durationMs,
    required this.tollFare,
    required this.fuelPrice,
    this.taxiFare,
    this.message,
    this.naverCode,
  });

  final bool ok;
  final List<GuideDirectionsPoint> path;
  final int distanceM;
  final int durationMs;
  final int tollFare;
  final int fuelPrice;
  final int? taxiFare;
  final String? message;
  final int? naverCode;

  factory GuideDirectionsResponse.fromJson(Map<String, dynamic> json) {
    final rawPath = json["path"];
    final path = rawPath is List
        ? rawPath
            .whereType<Map>()
            .map((e) => GuideDirectionsPoint.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : const <GuideDirectionsPoint>[];
    return GuideDirectionsResponse(
      ok: json["ok"] == true,
      path: path,
      distanceM: (json["distance_m"] as num?)?.toInt() ?? 0,
      durationMs: (json["duration_ms"] as num?)?.toInt() ?? 0,
      tollFare: (json["toll_fare"] as num?)?.toInt() ?? 0,
      fuelPrice: (json["fuel_price"] as num?)?.toInt() ?? 0,
      taxiFare: (json["taxi_fare"] as num?)?.toInt(),
      message: json["message"]?.toString(),
      naverCode: (json["naver_code"] as num?)?.toInt(),
    );
  }

  factory GuideDirectionsResponse.locationRequired() {
    return GuideDirectionsResponse(
      ok: false,
      path: const [],
      distanceM: 0,
      durationMs: 0,
      tollFare: 0,
      fuelPrice: 0,
      message:
          "현재 위치를 확인할 수 없어 차량 경로를 안내할 수 없어요. 위치 권한을 허용한 뒤 다시 시도해 주세요.",
    );
  }
}

class GuideDirectionsPoint {
  GuideDirectionsPoint({required this.lat, required this.lng});

  final double lat;
  final double lng;

  factory GuideDirectionsPoint.fromJson(Map<String, dynamic> json) {
    return GuideDirectionsPoint(
      lat: _parseDouble(json["lat"]) ?? 0,
      lng: _parseDouble(json["lng"]) ?? 0,
    );
  }
}

class GuidePlaceDetailsResponse {
  GuidePlaceDetailsResponse({
    required this.title,
    required this.category,
    required this.address,
    required this.telephone,
    required this.link,
    required this.imageUrl,
    required this.naverMatched,
  });

  final String title;
  final String category;
  final String address;
  final String telephone;
  final String link;
  final String? imageUrl;
  final bool naverMatched;

  factory GuidePlaceDetailsResponse.fromJson(Map<String, dynamic> json) {
    return GuidePlaceDetailsResponse(
      title: json["title"]?.toString() ?? "",
      category: json["category"]?.toString() ?? "",
      address: json["address"]?.toString() ?? "",
      telephone: json["telephone"]?.toString() ?? "",
      link: json["link"]?.toString() ?? "",
      imageUrl: _nullIfEmpty(json["imageUrl"]?.toString()),
      naverMatched: json["naverMatched"] == true,
    );
  }

  factory GuidePlaceDetailsResponse.empty() {
    return GuidePlaceDetailsResponse(
      title: "",
      category: "정보 없음",
      address: "정보 없음",
      telephone: "정보 없음",
      link: "정보 없음",
      imageUrl: null,
      naverMatched: false,
    );
  }
}

class GuideNearbyPlaceItem {
  GuideNearbyPlaceItem({
    required this.name,
    required this.category,
    required this.address,
    required this.imageUrl,
    required this.lat,
    required this.lng,
    required this.distanceM,
  });

  final String name;
  final String category;
  final String address;
  final String imageUrl;
  final double lat;
  final double lng;
  final double distanceM;

  factory GuideNearbyPlaceItem.fromJson(Map<String, dynamic> json) {
    return GuideNearbyPlaceItem(
      name: json["name"]?.toString() ?? "",
      category: json["category"]?.toString() ?? "",
      address: json["address"]?.toString() ?? "",
      imageUrl: json["imageUrl"]?.toString() ?? "",
      lat: _parseDouble(json["lat"]) ?? 0,
      lng: _parseDouble(json["lng"]) ?? 0,
      distanceM: _parseDouble(json["distanceM"]) ?? 0,
    );
  }
}

class GuideNearbyPlacesResponse {
  GuideNearbyPlacesResponse({required this.items});

  final List<GuideNearbyPlaceItem> items;

  factory GuideNearbyPlacesResponse.fromJson(Map<String, dynamic> json) {
    final raw = json["items"];
    if (raw is! List) return GuideNearbyPlacesResponse(items: const []);
    return GuideNearbyPlacesResponse(
      items: raw
          .whereType<Map>()
          .map((e) => GuideNearbyPlaceItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

enum GuideMarkerKind { place, festival }

/// 지도·바텀시트용 마커 (웹 MapMarker 대응)
class GuideMapMarker {
  GuideMapMarker({
    required this.id,
    required this.lat,
    required this.lng,
    required this.title,
    required this.kind,
    required this.address,
    required this.category,
    required this.description,
    this.summary,
    this.tip,
    this.imageUrl,
    this.photoSpot,
    this.estimatedCost,
    this.visitDuration,
    this.keywords,
    this.recommendationPoints,
    this.fstvlStartDate,
    this.fstvlEndDate,
    this.opar,
    this.homepageUrl,
  });

  final String id;
  final double lat;
  final double lng;
  final String title;
  final GuideMarkerKind kind;
  final String address;
  final String category;
  final String description;
  final String? summary;
  final String? tip;
  final String? imageUrl;
  final String? photoSpot;
  final String? estimatedCost;
  final String? visitDuration;
  final List<String>? keywords;
  final List<GuidePlaceRecommendationPoint>? recommendationPoints;

  final String? fstvlStartDate;
  final String? fstvlEndDate;
  final String? opar;
  final String? homepageUrl;
}
