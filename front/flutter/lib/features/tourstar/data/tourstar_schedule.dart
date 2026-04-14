import "dart:convert";

import "../../planner/data/planner_models.dart";

/// 여행 플래너 [TravelPlanRecord]를 게시글에 저장할 JSON 스냅샷으로 직렬화한다.
Map<String, dynamic> attachedScheduleFromTravelPlan(TravelPlanRecord plan) {
  return {
    "plan_id": plan.id,
    "route_name": plan.routeName,
    "location": plan.location,
    "start_date": plan.startDate,
    "end_date": plan.endDate,
    "schedule": plan.schedule.map((e) => e.toJson()).toList(),
  };
}

bool tourstarAttachedScheduleIsEmpty(Map<String, dynamic>? data) {
  if (data == null || data.isEmpty) return true;
  // DB에 plan_id만 있거나, 일차 스케줄이 비어 있어도 "붙인 일정"으로 본다.
  final pid = data["plan_id"];
  if (pid != null && "$pid".trim().isNotEmpty) return false;
  final sched = data["schedule"];
  if (sched is List && sched.isNotEmpty) return false;
  final title = "${data["route_name"] ?? ""}${data["location"] ?? ""}".trim();
  return title.isEmpty;
}

dynamic _unwrapJsonIfString(dynamic raw) {
  if (raw is String) {
    final s = raw.trim();
    if (s.isEmpty || s == "null") return null;
    try {
      final decoded = jsonDecode(s);
      return decoded;
    } catch (_) {
      return null;
    }
  }
  return raw;
}

/// API/게이트웨이에 따라 `attached_schedule` 또는 `attachedSchedule` 로 올 수 있다.
/// 일부 프록시는 JSON 객체를 문자열로 한 번 더 감싸기도 한다.
Map<String, dynamic>? parseAttachedScheduleFromPostJson(Map<String, dynamic> json) {
  dynamic raw = json["attached_schedule"] ?? json["attachedSchedule"];
  raw = _unwrapJsonIfString(raw);
  if (raw == null) return null;
  raw = _unwrapJsonIfString(raw);
  if (raw is! Map) return null;
  return Map<String, dynamic>.from(
    raw.map((k, v) => MapEntry(k.toString(), v)),
  );
}
