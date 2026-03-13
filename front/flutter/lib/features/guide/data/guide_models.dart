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
