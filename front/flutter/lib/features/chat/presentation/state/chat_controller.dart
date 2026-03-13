import "dart:async";

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../data/chat_models.dart";
import "../../data/chat_repository.dart";
import "chat_state.dart";

final chatControllerProvider = NotifierProvider<ChatController, ChatState>(
  ChatController.new,
);

class ChatController extends Notifier<ChatState> {
  ChatRepository get _repo => ref.read(chatRepositoryProvider);
  Timer? _pollTimer;

  @override
  ChatState build() {
    ref.onDispose(() {
      _pollTimer?.cancel();
      _pollTimer = null;
    });
    Future<void>.microtask(loadInitial);
    return ChatState.initial();
  }

  Future<void> loadInitial() async {
    await loadRooms();
    await loadWhispers();
  }

  Future<void> loadRooms() async {
    state = state.copyWith(loading: true, message: "대화방 목록 로드 중...");
    try {
      final rooms = await _repo.getRooms();
      state = state.copyWith(
        loading: false,
        rooms: rooms,
        message: "대화방 ${rooms.length}개 로드 완료",
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        message: "대화방 로드 실패: $e",
      );
    }
  }

  Future<void> enterRoom(String roomType) async {
    state = state.copyWith(selectedRoomType: roomType, groupMessages: const []);
    await loadGroupMessages();
    _startGroupPolling();
  }

  void leaveRoom() {
    _pollTimer?.cancel();
    _pollTimer = null;
    state = state.copyWith(clearSelectedRoom: true, groupMessages: const []);
  }

  Future<void> loadGroupMessages() async {
    final roomType = state.selectedRoomType;
    if (roomType == null || roomType.isEmpty) return;
    try {
      final messages = await _repo.getRecentMessages(roomType: roomType, limit: 100);
      messages.sort((a, b) {
        final ta = a.createdAt?.millisecondsSinceEpoch ?? 0;
        final tb = b.createdAt?.millisecondsSinceEpoch ?? 0;
        return ta.compareTo(tb);
      });
      state = state.copyWith(
        groupMessages: messages,
        message: "메시지 ${messages.length}건 로드 완료",
      );
    } catch (e) {
      state = state.copyWith(message: "메시지 로드 실패: $e");
    }
  }

  void setGroupInput(String value) {
    state = state.copyWith(groupInput: value);
  }

  Future<void> sendGroupMessage() async {
    final roomType = state.selectedRoomType;
    final text = state.groupInput.trim();
    if (roomType == null || roomType.isEmpty || text.isEmpty) return;
    state = state.copyWith(sending: true);
    try {
      final sent = await _repo.sendGroupMessage(roomType: roomType, message: text);
      final next = <GroupChatMessage>[...state.groupMessages];
      if (sent != null) {
        next.add(sent);
      }
      next.sort((a, b) {
        final ta = a.createdAt?.millisecondsSinceEpoch ?? 0;
        final tb = b.createdAt?.millisecondsSinceEpoch ?? 0;
        return ta.compareTo(tb);
      });
      state = state.copyWith(
        sending: false,
        groupInput: "",
        groupMessages: _dedupById(next),
        message: "메시지 전송 완료",
      );
    } catch (e) {
      state = state.copyWith(sending: false, message: "메시지 전송 실패: $e");
    }
  }

  Future<void> loadWhispers() async {
    try {
      final results = await Future.wait([
        _repo.getInbox(size: 50),
        _repo.getSent(size: 50),
      ]);
      state = state.copyWith(
        inbox: results[0],
        sent: results[1],
      );
    } catch (e) {
      state = state.copyWith(message: "귓속말 로드 실패: $e");
    }
  }

  void setWhisperTab(WhisperTab tab) {
    state = state.copyWith(whisperTab: tab);
  }

  void setWhisperTargetUserIdText(String value) {
    state = state.copyWith(whisperTargetUserIdText: value);
  }

  void setWhisperInput(String value) {
    state = state.copyWith(whisperInput: value);
  }

  Future<void> sendWhisper() async {
    final toUserId = int.tryParse(state.whisperTargetUserIdText.trim());
    final text = state.whisperInput.trim();
    if (toUserId == null || toUserId <= 0 || text.isEmpty) {
      state = state.copyWith(message: "받는 사용자 ID와 메시지를 확인해 주세요.");
      return;
    }
    state = state.copyWith(sending: true, message: "귓속말 전송 중...");
    try {
      await _repo.sendWhisper(toUserId: toUserId, message: text);
      state = state.copyWith(
        sending: false,
        whisperInput: "",
        message: "귓속말 전송 완료",
      );
      await loadWhispers();
    } catch (e) {
      state = state.copyWith(sending: false, message: "귓속말 전송 실패: $e");
    }
  }

  void _startGroupPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (state.selectedRoomType == null) return;
      unawaited(loadGroupMessages());
    });
  }

  List<GroupChatMessage> _dedupById(List<GroupChatMessage> source) {
    final byId = <String, GroupChatMessage>{};
    for (final msg in source) {
      final key = msg.id?.toString() ?? "${msg.userId}-${msg.createdAt?.millisecondsSinceEpoch}-${msg.message}";
      byId[key] = msg;
    }
    final out = byId.values.toList();
    out.sort((a, b) {
      final ta = a.createdAt?.millisecondsSinceEpoch ?? 0;
      final tb = b.createdAt?.millisecondsSinceEpoch ?? 0;
      return ta.compareTo(tb);
    });
    return out;
  }
}
