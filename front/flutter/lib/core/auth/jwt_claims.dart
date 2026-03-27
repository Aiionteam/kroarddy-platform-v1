import "dart:convert";

Map<String, dynamic>? decodeJwtPayload(String token) {
  try {
    final parts = token.split(".");
    if (parts.length != 3) return null;
    final normalized = base64Url.normalize(parts[1]);
    final decoded = utf8.decode(base64Url.decode(normalized));
    final dynamic parsed = jsonDecode(decoded);
    if (parsed is Map<String, dynamic>) return parsed;
    if (parsed is Map) return Map<String, dynamic>.from(parsed);
    return null;
  } catch (_) {
    return null;
  }
}

int? getUserIdFromToken(String token) {
  final payload = decodeJwtPayload(token);
  final raw = payload?["sub"] ?? payload?["userId"] ?? payload?["id"];
  final id = int.tryParse(raw?.toString() ?? "");
  return (id != null && id > 0) ? id : null;
}

int? getAppUserIdFromToken(String token) {
  final payload = decodeJwtPayload(token);
  final raw = payload?["app_user_id"] ?? payload?["appUserId"] ?? payload?["userId"];
  final id = int.tryParse(raw?.toString() ?? "");
  return (id != null && id > 0) ? id : null;
}

String? getNicknameFromToken(String token) {
  final payload = decodeJwtPayload(token);
  // sub(userId)는 fallback으로 사용하지 않음 - 실제 닉네임 claim만 사용
  final raw = payload?["nickname"] ??
      payload?["name"] ??
      payload?["preferred_username"];
  if (raw == null) return null;
  final s = raw.toString().trim();
  return s.isEmpty ? null : s;
}
