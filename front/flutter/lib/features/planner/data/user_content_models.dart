class RouteItemInput {
  RouteItemInput({
    required this.place,
    this.note,
  });

  final String place;
  final String? note;

  Map<String, dynamic> toJson() => {
        "place": place,
        "note": note,
      };
}

class PolishedRouteItem {
  PolishedRouteItem({
    required this.order,
    required this.place,
    required this.description,
    required this.tip,
  });

  final int order;
  final String place;
  final String description;
  final String tip;

  factory PolishedRouteItem.fromJson(Map<String, dynamic> json) {
    return PolishedRouteItem(
      order: (json["order"] as num?)?.toInt() ?? 0,
      place: json["place"]?.toString() ?? "",
      description: json["description"]?.toString() ?? "",
      tip: json["tip"]?.toString() ?? "",
    );
  }

  Map<String, dynamic> toJson() => {
        "order": order,
        "place": place,
        "description": description,
        "tip": tip,
      };
}

class PolishResponse {
  PolishResponse({
    required this.title,
    required this.location,
    required this.description,
    required this.routeItems,
    required this.tags,
  });

  final String title;
  final String location;
  final String description;
  final List<PolishedRouteItem> routeItems;
  final List<String> tags;

  factory PolishResponse.fromJson(Map<String, dynamic> json) {
    final itemsRaw = (json["route_items"] as List?) ?? const [];
    final tagsRaw = (json["tags"] as List?) ?? const [];
    return PolishResponse(
      title: json["title"]?.toString() ?? "",
      location: json["location"]?.toString() ?? "",
      description: json["description"]?.toString() ?? "",
      routeItems: itemsRaw
          .whereType<Map>()
          .map((e) => PolishedRouteItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      tags: tagsRaw.map((e) => e.toString()).toList(),
    );
  }
}

class UserRoute {
  UserRoute({
    required this.id,
    required this.userId,
    required this.title,
    required this.location,
    required this.description,
    required this.routeItems,
    required this.tags,
    required this.imageUrl,
    required this.likes,
    required this.createdAt,
  });

  final int id;
  final int? userId;
  final String title;
  final String location;
  final String description;
  final List<PolishedRouteItem> routeItems;
  final List<String> tags;
  final String? imageUrl;
  final int likes;
  final String createdAt;

  factory UserRoute.fromJson(Map<String, dynamic> json) {
    final itemsRaw = (json["route_items"] as List?) ?? const [];
    final tagsRaw = (json["tags"] as List?) ?? const [];
    return UserRoute(
      id: (json["id"] as num?)?.toInt() ?? 0,
      userId: (json["user_id"] as num?)?.toInt(),
      title: json["title"]?.toString() ?? "",
      location: json["location"]?.toString() ?? "",
      description: json["description"]?.toString() ?? "",
      routeItems: itemsRaw
          .whereType<Map>()
          .map((e) => PolishedRouteItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      tags: tagsRaw.map((e) => e.toString()).toList(),
      imageUrl: json["image_url"]?.toString(),
      likes: (json["likes"] as num?)?.toInt() ?? 0,
      createdAt: json["created_at"]?.toString() ?? "",
    );
  }
}

class ValidateImageResult {
  ValidateImageResult({
    required this.isSafe,
    required this.nsfwScore,
    required this.uploadUrl,
    required this.imageUrl,
  });

  final bool isSafe;
  final double nsfwScore;
  final String uploadUrl;
  final String imageUrl;

  factory ValidateImageResult.fromJson(Map<String, dynamic> json) {
    return ValidateImageResult(
      isSafe: json["is_safe"] == true,
      nsfwScore: (json["nsfw_score"] as num?)?.toDouble() ?? 0.0,
      uploadUrl: json["upload_url"]?.toString() ?? "",
      imageUrl: json["image_url"]?.toString() ?? "",
    );
  }
}
