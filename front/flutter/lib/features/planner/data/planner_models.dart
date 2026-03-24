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

  factory ScheduleItem.fromJson(Map<String, dynamic> json) {
    return ScheduleItem(
      day: (json["day"] as num?)?.toInt() ?? 0,
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

class CostSummaryItem {
  CostSummaryItem({required this.day, required this.total});

  final int day;
  final String total;

  factory CostSummaryItem.fromJson(Map<String, dynamic> json) {
    return CostSummaryItem(
      day: (json["day"] as num?)?.toInt() ?? 0,
      total: json["total"]?.toString() ?? "",
    );
  }
}

class CostSummary {
  CostSummary({required this.perDay, required this.tripTotal});

  final List<CostSummaryItem> perDay;
  final String tripTotal;

  factory CostSummary.fromJson(Map<String, dynamic> json) {
    final perDayRaw = (json["per_day"] as List?) ?? const [];
    return CostSummary(
      perDay: perDayRaw
          .whereType<Map>()
          .map((e) => CostSummaryItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      tripTotal: json["trip_total"]?.toString() ?? "",
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
    required this.costSummary,
    required this.error,
  });

  final String location;
  final String locationName;
  final String routeName;
  final List<ScheduleItem> schedule;
  final CostSummary? costSummary;
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
      costSummary: json["cost_summary"] is Map
          ? CostSummary.fromJson(Map<String, dynamic>.from(json["cost_summary"] as Map))
          : null,
      error: json["error"]?.toString(),
    );
  }
}

class SavePlanResponse {
  SavePlanResponse({
    required this.planId,
    required this.location,
    required this.locationName,
  });

  final int planId;
  final String location;
  final String locationName;

  factory SavePlanResponse.fromJson(Map<String, dynamic> json) {
    return SavePlanResponse(
      planId: (json["plan_id"] as num?)?.toInt() ?? 0,
      location: json["location"]?.toString() ?? "",
      locationName: json["location_name"]?.toString() ?? "",
    );
  }
}

class TravelPlanRecord {
  TravelPlanRecord({
    required this.id,
    required this.userId,
    required this.location,
    required this.routeName,
    required this.startDate,
    required this.endDate,
    required this.schedule,
    required this.createdAt,
  });

  final int id;
  final int userId;
  final String location;
  final String routeName;
  final String? startDate;
  final String? endDate;
  final List<ScheduleItem> schedule;
  final String createdAt;

  factory TravelPlanRecord.fromJson(Map<String, dynamic> json) {
    final scheduleRaw = (json["schedule"] as List?) ?? const [];
    return TravelPlanRecord(
      id: (json["id"] as num?)?.toInt() ?? 0,
      userId: (json["user_id"] as num?)?.toInt() ?? 0,
      location: json["location"]?.toString() ?? "",
      routeName: json["route_name"]?.toString() ?? "",
      startDate: json["start_date"]?.toString(),
      endDate: json["end_date"]?.toString(),
      schedule: scheduleRaw
          .whereType<Map>()
          .map((e) => ScheduleItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      createdAt: json["created_at"]?.toString() ?? "",
    );
  }
}

class ModifyResponse {
  ModifyResponse({
    required this.planId,
    required this.schedule,
    required this.modifiedTitles,
    required this.notPossible,
    required this.reason,
    required this.error,
  });

  final int planId;
  final List<ScheduleItem> schedule;
  final List<String> modifiedTitles;
  final bool notPossible;
  final String? reason;
  final String? error;

  factory ModifyResponse.fromJson(Map<String, dynamic> json) {
    final scheduleRaw = (json["schedule"] as List?) ?? const [];
    final titlesRaw = (json["modified_titles"] as List?) ?? const [];
    return ModifyResponse(
      planId: (json["plan_id"] as num?)?.toInt() ?? 0,
      schedule: scheduleRaw
          .whereType<Map>()
          .map((e) => ScheduleItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      modifiedTitles: titlesRaw.map((e) => e.toString()).toList(),
      notPossible: json["not_possible"] == true,
      reason: json["reason"]?.toString(),
      error: json["error"]?.toString(),
    );
  }
}

class RerollResponse {
  RerollResponse({
    required this.planId,
    required this.itemIndex,
    required this.newItem,
    required this.schedule,
  });

  final int planId;
  final int itemIndex;
  final ScheduleItem? newItem;
  final List<ScheduleItem> schedule;

  factory RerollResponse.fromJson(Map<String, dynamic> json) {
    final scheduleRaw = (json["schedule"] as List?) ?? const [];
    return RerollResponse(
      planId: (json["plan_id"] as num?)?.toInt() ?? 0,
      itemIndex: (json["item_index"] as num?)?.toInt() ?? -1,
      newItem: json["new_item"] is Map
          ? ScheduleItem.fromJson(Map<String, dynamic>.from(json["new_item"] as Map))
          : null,
      schedule: scheduleRaw
          .whereType<Map>()
          .map((e) => ScheduleItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}
