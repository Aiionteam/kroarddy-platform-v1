class ChatRoomInfo {
  ChatRoomInfo({
    required this.roomType,
    required this.label,
    required this.minHonor,
    required this.accessible,
  });

  final String roomType;
  final String label;
  final int minHonor;
  final bool accessible;

  factory ChatRoomInfo.fromJson(Map<String, dynamic> json) {
    return ChatRoomInfo(
      roomType: json["roomType"]?.toString() ?? "SILVER",
      label: json["label"]?.toString() ?? "실버",
      minHonor: (json["minHonor"] as num?)?.toInt() ?? 0,
      accessible: json["accessible"] == true,
    );
  }
}

class GroupChatMessage {
  GroupChatMessage({
    required this.id,
    required this.roomType,
    required this.userId,
    required this.username,
    required this.message,
    required this.createdAt,
  });

  final int? id;
  final String? roomType;
  final int? userId;
  final String? username;
  final String message;
  final DateTime? createdAt;

  factory GroupChatMessage.fromJson(Map<String, dynamic> json) {
    return GroupChatMessage(
      id: (json["id"] as num?)?.toInt(),
      roomType: json["roomType"]?.toString(),
      userId: (json["userId"] as num?)?.toInt(),
      username: json["username"]?.toString(),
      message: json["message"]?.toString() ?? "",
      createdAt: DateTime.tryParse(json["createdAt"]?.toString() ?? ""),
    );
  }
}

class WhisperMessage {
  WhisperMessage({
    required this.id,
    required this.fromUserId,
    required this.toUserId,
    required this.fromUsername,
    required this.toUsername,
    required this.message,
    required this.createdAt,
  });

  final int? id;
  final int? fromUserId;
  final int? toUserId;
  final String? fromUsername;
  final String? toUsername;
  final String message;
  final DateTime? createdAt;

  factory WhisperMessage.fromJson(Map<String, dynamic> json) {
    return WhisperMessage(
      id: (json["id"] as num?)?.toInt(),
      fromUserId: (json["fromUserId"] as num?)?.toInt(),
      toUserId: (json["toUserId"] as num?)?.toInt(),
      fromUsername: json["fromUsername"]?.toString(),
      toUsername: json["toUsername"]?.toString(),
      message: json["message"]?.toString() ?? "",
      createdAt: DateTime.tryParse(json["createdAt"]?.toString() ?? ""),
    );
  }
}
