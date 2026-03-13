import "../../data/chat_models.dart";

enum WhisperTab { inbox, sent }

class ChatState {
  const ChatState({
    required this.loading,
    required this.sending,
    required this.message,
    required this.rooms,
    required this.selectedRoomType,
    required this.groupMessages,
    required this.groupInput,
    required this.inbox,
    required this.sent,
    required this.whisperTab,
    required this.whisperTargetUserIdText,
    required this.whisperInput,
  });

  factory ChatState.initial() {
    return const ChatState(
      loading: false,
      sending: false,
      message: "채팅을 시작하세요.",
      rooms: <ChatRoomInfo>[],
      selectedRoomType: null,
      groupMessages: <GroupChatMessage>[],
      groupInput: "",
      inbox: <WhisperMessage>[],
      sent: <WhisperMessage>[],
      whisperTab: WhisperTab.inbox,
      whisperTargetUserIdText: "",
      whisperInput: "",
    );
  }

  final bool loading;
  final bool sending;
  final String message;
  final List<ChatRoomInfo> rooms;
  final String? selectedRoomType;
  final List<GroupChatMessage> groupMessages;
  final String groupInput;
  final List<WhisperMessage> inbox;
  final List<WhisperMessage> sent;
  final WhisperTab whisperTab;
  final String whisperTargetUserIdText;
  final String whisperInput;

  ChatState copyWith({
    bool? loading,
    bool? sending,
    String? message,
    List<ChatRoomInfo>? rooms,
    String? selectedRoomType,
    List<GroupChatMessage>? groupMessages,
    String? groupInput,
    List<WhisperMessage>? inbox,
    List<WhisperMessage>? sent,
    WhisperTab? whisperTab,
    String? whisperTargetUserIdText,
    String? whisperInput,
    bool clearSelectedRoom = false,
  }) {
    return ChatState(
      loading: loading ?? this.loading,
      sending: sending ?? this.sending,
      message: message ?? this.message,
      rooms: rooms ?? this.rooms,
      selectedRoomType: clearSelectedRoom ? null : (selectedRoomType ?? this.selectedRoomType),
      groupMessages: groupMessages ?? this.groupMessages,
      groupInput: groupInput ?? this.groupInput,
      inbox: inbox ?? this.inbox,
      sent: sent ?? this.sent,
      whisperTab: whisperTab ?? this.whisperTab,
      whisperTargetUserIdText: whisperTargetUserIdText ?? this.whisperTargetUserIdText,
      whisperInput: whisperInput ?? this.whisperInput,
    );
  }
}
