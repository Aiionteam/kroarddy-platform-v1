import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/network/api_client.dart";

final friendRepositoryProvider = Provider<FriendRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return FriendRepository(dio);
});

class FriendInfo {
  FriendInfo({
    required this.userId,
    required this.nickname,
    this.profileImageUrl,
    this.honorScore = 0,
  });

  final int userId;
  final String nickname;
  final String? profileImageUrl;
  final int honorScore;

  factory FriendInfo.fromJson(Map<String, dynamic> json) {
    final id = (json["id"] ?? json["userId"] ?? json["user_id"]);
    return FriendInfo(
      userId: (id as num?)?.toInt() ?? 0,
      nickname: json["nickname"]?.toString() ?? "",
      profileImageUrl: json["profileImageUrl"]?.toString() ??
          json["profile_image_url"]?.toString(),
      honorScore: (json["honorScore"] ?? json["honor_score"] as num?)?.toInt() ?? 0,
    );
  }
}

class FriendRequest {
  FriendRequest({
    required this.fromUserId,
    required this.nickname,
    this.profileImageUrl,
  });

  final int fromUserId;
  final String nickname;
  final String? profileImageUrl;

  factory FriendRequest.fromJson(Map<String, dynamic> json) {
    final id = json["fromUserId"] ?? json["from_user_id"] ?? json["id"];
    return FriendRequest(
      fromUserId: (id as num?)?.toInt() ?? 0,
      nickname: json["nickname"]?.toString() ?? "",
      profileImageUrl: json["profileImageUrl"]?.toString() ??
          json["profile_image_url"]?.toString(),
    );
  }
}

class FriendRepository {
  FriendRepository(this._dio);

  final Dio _dio;

  List<T> _parseList<T>(
    dynamic body,
    T Function(Map<String, dynamic>) fromJson,
  ) {
    List<dynamic>? list;
    if (body is Map) {
      list = (body["data"] ?? body["content"]) as List<dynamic>?;
    } else if (body is List) {
      list = body;
    }
    return (list ?? const [])
        .whereType<Map>()
        .map((e) => fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  // ── 친구 목록 ──────────────────────────────────────────────
  Future<List<FriendInfo>> getFriendList() async {
    final res = await _dio.get<dynamic>("/friends");
    return _parseList(res.data, FriendInfo.fromJson);
  }

  // ── 받은 친구 요청 목록 ────────────────────────────────────
  Future<List<FriendRequest>> getPendingRequests() async {
    final res = await _dio.get<dynamic>("/friends/requests");
    return _parseList(res.data, FriendRequest.fromJson);
  }

  // ── 친구 요청 보내기 ───────────────────────────────────────
  Future<bool> sendFriendRequest(int toUserId) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        "/friends/request",
        data: {"toUserId": toUserId},
      );
      final code = res.data?["code"];
      return code == null || code == 200 || code == 201;
    } catch (_) {
      return false;
    }
  }

  // ── 친구 요청 수락 ─────────────────────────────────────────
  Future<bool> acceptFriendRequest(int fromUserId) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        "/friends/accept",
        data: {"fromUserId": fromUserId},
      );
      final code = res.data?["code"];
      return code == null || code == 200 || code == 201;
    } catch (_) {
      return false;
    }
  }

  // ── 친구 삭제 ──────────────────────────────────────────────
  Future<bool> deleteFriend(int targetId) async {
    try {
      await _dio.delete<dynamic>("/friends/$targetId");
      return true;
    } catch (_) {
      return false;
    }
  }

  // ── 닉네임으로 사용자 찾기 ─────────────────────────────────
  Future<int?> findUserIdByNickname(String nickname) async {
    try {
      final res = await _dio.get<dynamic>(
        "/users",
        queryParameters: {"nickname": nickname},
      );
      final body = res.data;
      List<dynamic>? list;
      if (body is Map) {
        final data = body["data"];
        if (data is List) list = data;
        else if (data is Map) {
          final id = data["id"] ?? data["userId"];
          return (id as num?)?.toInt();
        }
      } else if (body is List) {
        list = body;
      }
      if (list != null) {
        for (final item in list) {
          if (item is Map) {
            final nick = item["nickname"]?.toString() ?? "";
            if (nick == nickname) {
              final id = item["id"] ?? item["userId"];
              return (id as num?)?.toInt();
            }
          }
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}
