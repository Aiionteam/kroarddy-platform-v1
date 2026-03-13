import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/network/api_client.dart";
import "chat_models.dart";

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return ChatRepository(dio);
});

class ChatRepository {
  ChatRepository(this._dio);

  final Dio _dio;

  Future<List<ChatRoomInfo>> getRooms() async {
    final res = await _dio.get<Map<String, dynamic>>("/groupchat/rooms");
    final body = res.data ?? const <String, dynamic>{};
    final code = body["code"];
    if (code != null && code != 200) {
      throw Exception(body["message"]?.toString() ?? "대화방 목록 조회 실패 (code: $code)");
    }
    final data = body["data"];
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => ChatRoomInfo.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
    return const <ChatRoomInfo>[];
  }

  Future<List<GroupChatMessage>> getRecentMessages({
    required String roomType,
    int limit = 50,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/groupchat/recent",
      queryParameters: {
        "roomType": roomType,
        "limit": limit,
      },
    );
    final body = res.data ?? const <String, dynamic>{};
    final code = body["code"];
    if (code != null && code != 200) {
      throw Exception(body["message"]?.toString() ?? "메시지 조회 실패 (code: $code)");
    }
    final data = body["data"];
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => GroupChatMessage.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
    return const <GroupChatMessage>[];
  }

  Future<GroupChatMessage?> sendGroupMessage({
    required String roomType,
    required String message,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/groupchat",
      data: {
        "roomType": roomType,
        "message": message,
        "lookingForBuddy": false,
      },
    );
    final body = res.data ?? const <String, dynamic>{};
    final data = body["data"];
    if (data is Map) {
      return GroupChatMessage.fromJson(Map<String, dynamic>.from(data));
    }
    if (data is List && data.isNotEmpty && data.first is Map) {
      return GroupChatMessage.fromJson(Map<String, dynamic>.from(data.first as Map));
    }
    return null;
  }

  Future<List<WhisperMessage>> getInbox({int size = 50}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/whisper/inbox",
      queryParameters: {"size": size},
    );
    return _parseWhisperList(res.data);
  }

  Future<List<WhisperMessage>> getSent({int size = 50}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/whisper/sent",
      queryParameters: {"size": size},
    );
    return _parseWhisperList(res.data);
  }

  Future<void> sendWhisper({
    required int toUserId,
    required String message,
  }) async {
    await _dio.post<Map<String, dynamic>>(
      "/whisper",
      data: {
        "toUserId": toUserId,
        "message": message,
      },
    );
  }

  List<WhisperMessage> _parseWhisperList(Map<String, dynamic>? body) {
    final data = body?["data"];
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => WhisperMessage.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
    if (data is Map) {
      return [WhisperMessage.fromJson(Map<String, dynamic>.from(data))];
    }
    return const <WhisperMessage>[];
  }
}
