class PlanRoute {
  PlanRoute({
    required this.name,
    required this.theme,
    required this.description,
    required this.highlights,
  });

  final String name;
  final String theme;
  final String description;
  final List<String> highlights;

  factory PlanRoute.fromJson(Map<String, dynamic> json) {
    final highlightsRaw = (json["highlights"] as List?) ?? const [];
    return PlanRoute(
      name: json["name"]?.toString() ?? "",
      theme: json["theme"]?.toString() ?? "",
      description: json["description"]?.toString() ?? "",
      highlights: highlightsRaw.map((e) => e.toString()).toList(),
    );
  }
}

class ScheduleItem {
  ScheduleItem({
    required this.day,
    required this.date,
    required this.time,
    required this.place,
    required this.title,
    required this.description,
    this.tips,
  });

  final int day;
  final String date;
  final String time;
  final String place;
  final String title;
  final String description;
  final String? tips;

  factory ScheduleItem.fromJson(Map<String, dynamic> json) {
    return ScheduleItem(
      day: (json["day"] as num?)?.toInt() ?? 0,
      date: json["date"]?.toString() ?? "",
      time: json["time"]?.toString() ?? "",
      place: json["place"]?.toString() ?? "",
      title: json["title"]?.toString() ?? "",
      description: json["description"]?.toString() ?? "",
      tips: json["tips"]?.toString(),
    );
  }
}

class RoutesResponse {
  RoutesResponse({
    required this.location,
    required this.locationName,
    required this.routes,
    required this.error,
  });

  final String location;
  final String locationName;
  final List<PlanRoute> routes;
  final String? error;

  factory RoutesResponse.fromJson(Map<String, dynamic> json) {
    final routesRaw = (json["routes"] as List?) ?? const [];
    return RoutesResponse(
      location: json["location"]?.toString() ?? "",
      locationName: json["location_name"]?.toString() ?? "",
      routes: routesRaw
          .whereType<Map>()
          .map((e) => PlanRoute.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      error: json["error"]?.toString(),
    );
  }
}

class ScheduleResponse {
  ScheduleResponse({
    required this.location,
    required this.locationName,
    required this.routeName,
    required this.schedule,
    required this.error,
  });

  final String location;
  final String locationName;
  final String routeName;
  final List<ScheduleItem> schedule;
  final String? error;

  factory ScheduleResponse.fromJson(Map<String, dynamic> json) {
    final scheduleRaw = (json["schedule"] as List?) ?? const [];
    return ScheduleResponse(
      location: json["location"]?.toString() ?? "",
      locationName: json["location_name"]?.toString() ?? "",
      routeName: json["route_name"]?.toString() ?? "",
      schedule: scheduleRaw
          .whereType<Map>()
          .map((e) => ScheduleItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      error: json["error"]?.toString(),
    );
  }
}
