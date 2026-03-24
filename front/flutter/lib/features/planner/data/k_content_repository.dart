import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/config/app_env.dart";
import "../../../core/network/api_client.dart";

final kContentRepositoryProvider = Provider<KContentRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return KContentRepository(dio);
});

class KContentRepository {
  KContentRepository(this._dio);

  final Dio _dio;

  String _webUrl(String path) {
    final base = AppEnv.webBaseUrl.replaceAll(RegExp(r"/+$"), "");
    final p = path.startsWith("/") ? path : "/$path";
    return "$base$p";
  }

  String pickRandomImage(List<String> images) {
    if (images.isEmpty) return "";
    final idx = DateTime.now().microsecondsSinceEpoch % images.length;
    return images[idx];
  }

  Future<List<String>> fetchBannerImages() async {
    try {
      final res = await _dio.getUri<Map<String, dynamic>>(
        Uri.parse(_webUrl("/api/k-content/images/banner")),
        options: Options(receiveTimeout: const Duration(seconds: 20)),
      );
      final raw = (res.data?["images"] as List?) ?? const [];
      return raw
          .map((e) => e?.toString() ?? "")
          .where((e) => e.isNotEmpty)
          .map((e) => e.startsWith("http") ? e : _webUrl(e))
          .toList();
    } catch (_) {
      return <String>[_webUrl("/k_content/banner/panorama-downtown-cityscape-seoul-tower-seoul-south-korea.jpg")];
    }
  }

  Future<List<String>> fetchPackageImages(String packageId) async {
    try {
      final res = await _dio.getUri<Map<String, dynamic>>(
        Uri.parse(_webUrl("/api/k-content/images/${Uri.encodeComponent(packageId)}")),
        options: Options(receiveTimeout: const Duration(seconds: 20)),
      );
      final raw = (res.data?["images"] as List?) ?? const [];
      return raw
          .map((e) => e?.toString() ?? "")
          .where((e) => e.isNotEmpty)
          .map((e) => e.startsWith("http") ? e : _webUrl(e))
          .toList();
    } catch (_) {
      return const [];
    }
  }

  Future<KContentGenerateResponse> generate({
    required String packageId,
    required String startDate,
    required String endDate,
    String? locationName,
    List<Map<String, dynamic>>? newsTop10,
    Map<String, dynamic>? userProfile,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/k-content/generate",
      data: {
        "package_id": packageId,
        "start_date": startDate,
        "end_date": endDate,
        "location_name": locationName,
        "news_top10": newsTop10,
        "user_profile": userProfile,
      },
      options: Options(receiveTimeout: const Duration(minutes: 2)),
    );
    return KContentGenerateResponse.fromJson(res.data ?? const {});
  }

  Future<KContentSaveResponse> save({
    required Map<String, dynamic> packageMeta,
    required List<Map<String, dynamic>> schedule,
    List<Map<String, dynamic>> places = const [],
    Map<String, dynamic>? costSummary,
    int? userId,
    String location = "K-Content",
    String? startDate,
    String? endDate,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/k-content/save",
      data: {
        "package_meta": packageMeta,
        "schedule": schedule,
        "places": places,
        "cost_summary": costSummary,
        "user_id": userId,
        "location": location,
        "start_date": startDate,
        "end_date": endDate,
      },
      options: Options(receiveTimeout: const Duration(minutes: 1)),
    );
    return KContentSaveResponse.fromJson(res.data ?? const {});
  }

  Future<Map<String, dynamic>> health() async {
    final res = await _dio.get<Map<String, dynamic>>("/v1/k-content/health");
    return res.data ?? const <String, dynamic>{};
  }
}

class KContentScheduleItem {
  KContentScheduleItem({
    required this.day,
    required this.date,
    required this.time,
    required this.place,
    required this.title,
    required this.description,
    this.tips,
    this.estimatedCost,
  });

  final int day;
  final String date;
  final String time;
  final String place;
  final String title;
  final String description;
  final String? tips;
  final String? estimatedCost;

  factory KContentScheduleItem.fromJson(Map<String, dynamic> json) {
    return KContentScheduleItem(
      day: (json["day"] as num?)?.toInt() ?? 1,
      date: json["date"]?.toString() ?? "",
      time: json["time"]?.toString() ?? "",
      place: json["place"]?.toString() ?? "",
      title: json["title"]?.toString() ?? "",
      description: json["description"]?.toString() ?? "",
      tips: json["tips"]?.toString(),
      estimatedCost: json["estimated_cost"]?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      "day": day,
      "date": date,
      "time": time,
      "place": place,
      "title": title,
      "description": description,
      "tips": tips,
      "estimated_cost": estimatedCost,
    };
  }
}

class KContentGenerateResponse {
  KContentGenerateResponse({
    required this.success,
    required this.packageMeta,
    required this.schedule,
    required this.places,
    required this.costSummary,
  });

  final bool success;
  final Map<String, dynamic>? packageMeta;
  final List<KContentScheduleItem> schedule;
  final List<Map<String, dynamic>> places;
  final Map<String, dynamic>? costSummary;

  factory KContentGenerateResponse.fromJson(Map<String, dynamic> json) {
    final rawSchedule = (json["schedule"] as List?) ?? const [];
    final rawPlaces = (json["places"] as List?) ?? const [];
    return KContentGenerateResponse(
      success: json["success"] == true,
      packageMeta: json["package_meta"] is Map
          ? Map<String, dynamic>.from(json["package_meta"] as Map)
          : null,
      schedule: rawSchedule
          .whereType<Map>()
          .map((e) => KContentScheduleItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      places: rawPlaces.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList(),
      costSummary: json["cost_summary"] is Map
          ? Map<String, dynamic>.from(json["cost_summary"] as Map)
          : null,
    );
  }
}

class KContentSaveResponse {
  KContentSaveResponse({
    required this.success,
    required this.planId,
    required this.location,
    required this.locationName,
    required this.routeName,
  });

  final bool success;
  final int planId;
  final String location;
  final String locationName;
  final String routeName;

  factory KContentSaveResponse.fromJson(Map<String, dynamic> json) {
    return KContentSaveResponse(
      success: json["success"] == true,
      planId: (json["plan_id"] as num?)?.toInt() ?? 0,
      location: json["location"]?.toString() ?? "",
      locationName: json["location_name"]?.toString() ?? "",
      routeName: json["route_name"]?.toString() ?? "",
    );
  }
}
