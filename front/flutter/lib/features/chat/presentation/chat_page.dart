import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/router/main_shell.dart";
import "../../../core/theme/kroaddy_colors.dart";
import "../../../core/utils/tourstar_share_parser.dart";
import "../../tourstar/data/tourstar_models.dart";
import "../../tourstar/data/tourstar_repository.dart";
import "../data/chat_models.dart";
import "state/chat_controller.dart";
import "state/chat_state.dart";

// ── 색상 상수 ─────────────────────────────────────────────────
const _primary = KroaddyColors.primary;
const _primaryLight = KroaddyColors.brandWash;
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _bgPage = Color(0xFFF8F7FF);
const _myBubble = KroaddyColors.primary;
const _otherBubble = Color(0xFFF3F4F6);

// ── 등급 색상 맵 ──────────────────────────────────────────────
const _tierColors = {
  "SILVER": Color(0xFF9CA3AF),
  "GOLD": Color(0xFFF59E0B),
  "PLATINUM": Color(0xFF06B6D4),
  "DIAMOND": Color(0xFF3B82F6),
};

Color _tierColor(String? tier) => _tierColors[tier?.toUpperCase()] ?? const Color(0xFF9CA3AF);

int _tierMinHonor(String roomType) {
  switch (roomType.toUpperCase()) {
    case "GOLD":
      return 100;
    case "PLATINUM":
      return 500;
    case "DIAMOND":
      return 1000;
    default:
      return 0;
  }
}

String _tierLabel(String roomType) {
  switch (roomType.toUpperCase()) {
    case "GOLD":
      return "GOLD";
    case "PLATINUM":
      return "PLATINUM";
    case "DIAMOND":
      return "DIAMOND";
    default:
      return "SILVER";
  }
}

String _groupRoomTitle(ChatRoomInfo room) {
  switch (room.roomType.toUpperCase()) {
    case "SILVER":
      return "screens.chat.tier_silver".tr();
    case "GOLD":
      return "screens.chat.tier_gold".tr();
    case "PLATINUM":
      return "screens.chat.tier_platinum".tr();
    case "DIAMOND":
      return "screens.chat.tier_diamond".tr();
    default:
      return room.label.isNotEmpty ? room.label : room.roomType;
  }
}

// ── 등급 배지 PNG (실버 / 골드 / 플래티넘 / 다이아) ─────────────
String _tierBadgeAsset(String? roomType) {
  switch ((roomType ?? "SILVER").toUpperCase()) {
    case "GOLD":
      return "icons/chat_icon/gold-Photoroom.png";
    case "PLATINUM":
      return "icons/chat_icon/platinum-Photoroom.png";
    case "DIAMOND":
      return "icons/chat_icon/dia-Photoroom.png";
    default:
      return "icons/chat_icon/silver-Photoroom.png";
  }
}

// ── 진입점 ─────────────────────────────────────────────────────
class ChatPage extends ConsumerWidget {
  const ChatPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: _bgPage,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.menu, color: _textPrimary),
          onPressed: () => mainScaffoldKey.currentState?.openDrawer(),
        ),
        title: Text(
          "sidebar.groupchat".tr(),
          style: const TextStyle(color: _textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
      body: const _GroupChatTab(),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// 그룹톡 탭
// ═══════════════════════════════════════════════════════════════
class _GroupChatTab extends ConsumerStatefulWidget {
  const _GroupChatTab();

  @override
  ConsumerState<_GroupChatTab> createState() => _GroupChatTabState();
}

class _GroupChatTabState extends ConsumerState<_GroupChatTab> {
  final _scrollController = ScrollController();
  final _inputController = TextEditingController();
  String? _whisperTargetUserId;
  String? _whisperTargetName;
  bool _showWhisperDialog = false;

  @override
  void dispose() {
    _scrollController.dispose();
    _inputController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatControllerProvider);
    final ctrl = ref.read(chatControllerProvider.notifier);

    ref.listen<int>(
      chatControllerProvider.select((s) => s.groupMessages.length),
      (_, _) => _scrollToBottom(),
    );

    // 방 목록 화면
    if (state.selectedRoomType == null) {
      return _buildRoomList(context, state, ctrl);
    }

    // 채팅 화면
    return _buildChatView(context, state, ctrl);
  }

  Widget _buildRoomList(BuildContext context, ChatState state, ChatController ctrl) {
    return Scaffold(
      backgroundColor: _bgPage,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (state.loading)
            const LinearProgressIndicator(color: _primary, minHeight: 2),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Text(
                  "screens.chat.room_list_header".tr(),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _textPrimary),
                ),
                const Spacer(),
                IconButton(
                  onPressed: ctrl.loadRooms,
                  icon: const Icon(Icons.refresh, size: 20, color: _textSecondary),
                ),
              ],
            ),
          ),
          if (state.rooms.isEmpty && !state.loading)
            Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text("💬", style: TextStyle(fontSize: 40)),
                    const SizedBox(height: 12),
                    Text(
                      state.message.contains("실패") ||
                              state.message.contains("인증") ||
                              state.message.contains("fail") ||
                              state.message.contains("auth")
                          ? state.message
                          : "screens.chat.cannot_load_rooms".tr(),
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 14, color: _textSecondary),
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton.icon(
                      onPressed: ctrl.loadRooms,
                      icon: const Icon(Icons.refresh, size: 16),
                      label: Text("common.retry".tr()),
                    ),
                  ],
                ),
              ),
            )
          else
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  Text(
                    "screens.chat.honor_rooms_note".tr(),
                    style: const TextStyle(fontSize: 12, color: _textSecondary),
                  ),
                  const SizedBox(height: 12),
                  ...state.rooms.map(
                    (room) => _RoomCard(
                      room: room,
                      onEnter: () => ctrl.enterRoom(room.roomType),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildChatView(BuildContext context, ChatState state, ChatController ctrl) {
    return Scaffold(
      backgroundColor: _bgPage,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: _textPrimary),
          onPressed: ctrl.leaveRoom,
        ),
        title: Row(
          children: [
            Image.asset(
              _tierBadgeAsset(state.selectedRoomType),
              width: 26,
              height: 26,
              fit: BoxFit.contain,
            ),
            const SizedBox(width: 8),
            Text(
              "screens.chat.group_room_title".tr(namedArgs: {"tier": _tierLabel(state.selectedRoomType ?? "")}),
              style: const TextStyle(
                color: _textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
          ],
        ),
        actions: [
          if (state.loading)
            const Padding(
              padding: EdgeInsets.only(right: 12),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: _primary),
              ),
            ),
        ],
      ),
      body: Stack(
        children: [
          Column(
            children: [
              Expanded(
                child: state.groupMessages.isEmpty
                    ? Center(
                        child: Text("screens.chat.no_messages".tr(), style: const TextStyle(color: _textSecondary)),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                        itemCount: state.groupMessages.length,
                        itemBuilder: (_, i) {
                          final msg = state.groupMessages[i];
                          return _ChatBubble(
                            message: msg,
                            isMe: false, // userId 비교는 추후 확장
                            onLongPress: () {
                              if (msg.userId != null) {
                                setState(() {
                                  _whisperTargetUserId = msg.userId.toString();
                                  _whisperTargetName = msg.username ?? "ID: ${msg.userId}";
                                  _showWhisperDialog = true;
                                });
                              }
                            },
                          );
                        },
                      ),
              ),
              // 입력창
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                child: SafeArea(
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _inputController,
                          onChanged: ctrl.setGroupInput,
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => _send(ctrl),
                          decoration: InputDecoration(
                            hintText: "screens.chat.hint_message".tr(),
                            hintStyle: const TextStyle(color: _textSecondary, fontSize: 14),
                            filled: true,
                            fillColor: const Color(0xFFF9FAFB),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(24),
                              borderSide: BorderSide.none,
                            ),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: state.sending ? null : () => _send(ctrl),
                        child: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: state.sending ? Colors.grey.shade300 : _primary,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            state.sending ? Icons.hourglass_empty : Icons.send,
                            color: Colors.white,
                            size: 18,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          // 개인톡 다이얼로그
          if (_showWhisperDialog)
            _WhisperOverlay(
              targetName: _whisperTargetName ?? "",
              targetId: _whisperTargetUserId ?? "",
              onSend: (text) async {
                final id = int.tryParse(_whisperTargetUserId ?? "");
                if (id != null && text.isNotEmpty) {
                  ctrl.setWhisperTargetUserIdText("$id");
                  ctrl.setWhisperInput(text);
                  await ctrl.sendWhisper();
                }
                setState(() => _showWhisperDialog = false);
              },
              onClose: () => setState(() => _showWhisperDialog = false),
            ),
        ],
      ),
    );
  }

  void _send(ChatController ctrl) {
    _inputController.clear();
    ctrl.sendGroupMessage();
  }
}

class _RoomCard extends StatelessWidget {
  const _RoomCard({required this.room, required this.onEnter});
  final ChatRoomInfo room;
  final VoidCallback onEnter;

  @override
  Widget build(BuildContext context) {
    final color = _tierColor(room.roomType);
    final minHonor = _tierMinHonor(room.roomType);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          SizedBox(
            width: 44,
            height: 44,
            child: Image.asset(
              _tierBadgeAsset(room.roomType),
              fit: BoxFit.contain,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _groupRoomTitle(room),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  minHonor > 0
                      ? "screens.chat.min_honor_required".tr(namedArgs: {"min": "$minHonor"})
                      : "screens.chat.open_to_all".tr(),
                  style: TextStyle(fontSize: 12, color: minHonor > 0 ? color : const Color(0xFF059669)),
                ),
              ],
            ),
          ),
          if (room.accessible)
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onEnter,
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                  child: Image.asset(
                    "icons/hwasalpyo.png",
                    width: 40,
                    height: 40,
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            )
          else
            FilledButton(
              onPressed: null,
              style: FilledButton.styleFrom(
                backgroundColor: Colors.grey.shade200,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              child: Text(
                "screens.chat.honor_insufficient".tr(),
                style: const TextStyle(fontSize: 12, color: _textSecondary),
              ),
            ),
        ],
      ),
    );
  }
}

class _ChatBubble extends StatelessWidget {
  const _ChatBubble({required this.message, required this.isMe, this.onLongPress});
  final GroupChatMessage message;
  final bool isMe;
  final VoidCallback? onLongPress;

  String _formatTime(DateTime? dt) {
    if (dt == null) return "";
    return "${dt.hour.toString().padLeft(2, "0")}:${dt.minute.toString().padLeft(2, "0")}";
  }

  @override
  Widget build(BuildContext context) {
    final postId = TourstarShareParser.extractPostId(message.message);
    if (postId != null) {
      return _TourstarShareCard(
        postId: postId,
        username: message.username,
        isMe: isMe,
        time: _formatTime(message.createdAt),
        onLongPress: onLongPress,
      );
    }

    return GestureDetector(
      onLongPress: onLongPress,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (!isMe) ...[
              CircleAvatar(
                radius: 16,
                backgroundColor: _primaryLight,
                child: Text(
                  (message.username ?? "?").substring(0, 1).toUpperCase(),
                  style: const TextStyle(fontSize: 12, color: _primary, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 8),
            ],
            Column(
              crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                if (!isMe && message.username != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      message.username!,
                      style: const TextStyle(fontSize: 11, color: _textSecondary),
                    ),
                  ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (isMe)
                      Text(
                        _formatTime(message.createdAt),
                        style: const TextStyle(fontSize: 10, color: _textSecondary),
                      ),
                    if (isMe) const SizedBox(width: 4),
                    ConstrainedBox(
                      constraints: BoxConstraints(
                        maxWidth: MediaQuery.of(context).size.width * 0.6,
                      ),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: isMe ? _myBubble : _otherBubble,
                          borderRadius: BorderRadius.only(
                            topLeft: const Radius.circular(16),
                            topRight: const Radius.circular(16),
                            bottomLeft: isMe ? const Radius.circular(16) : const Radius.circular(4),
                            bottomRight: isMe ? const Radius.circular(4) : const Radius.circular(16),
                          ),
                        ),
                        child: Text(
                          message.message,
                          style: TextStyle(
                            fontSize: 14,
                            color: isMe ? Colors.white : _textPrimary,
                          ),
                        ),
                      ),
                    ),
                    if (!isMe) const SizedBox(width: 4),
                    if (!isMe)
                      Text(
                        _formatTime(message.createdAt),
                        style: const TextStyle(fontSize: 10, color: _textSecondary),
                      ),
                  ],
                ),
              ],
            ),
            if (isMe) ...[
              const SizedBox(width: 8),
              CircleAvatar(
                radius: 16,
                backgroundColor: _primaryLight,
                child: Text(
                  "screens.chat.me".tr(),
                  style: const TextStyle(fontSize: 10, color: _primary, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── 여행피드 공유 카드 ─────────────────────────────────────────
class _TourstarShareCard extends ConsumerStatefulWidget {
  const _TourstarShareCard({
    required this.postId,
    required this.isMe,
    required this.time,
    this.username,
    this.onLongPress,
  });
  final String postId;
  final String? username;
  final bool isMe;
  final String time;
  final VoidCallback? onLongPress;

  @override
  ConsumerState<_TourstarShareCard> createState() => _TourstarShareCardState();
}

class _TourstarShareCardState extends ConsumerState<_TourstarShareCard> {
  TourstarSharePreview? _preview;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final repo = ref.read(tourstarRepositoryProvider);
      final preview = await repo.getSharePreview(widget.postId);
      if (mounted) setState(() { _preview = preview; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPress: widget.onLongPress,
      onTap: () => context.push("/tourstar?postId=${Uri.encodeComponent(widget.postId)}"),
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment: widget.isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (!widget.isMe) ...[
              CircleAvatar(
                radius: 16,
                backgroundColor: _primaryLight,
                child: Text(
                  (widget.username ?? "?").substring(0, 1).toUpperCase(),
                  style: const TextStyle(fontSize: 12, color: _primary, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 8),
            ],
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
              child: Column(
                crossAxisAlignment: widget.isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                children: [
                  if (!widget.isMe && widget.username != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(widget.username!, style: const TextStyle(fontSize: 11, color: _textSecondary)),
                    ),
                  // 카드 본문
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFEDE9FE)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.06),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: _loading
                        ? SizedBox(
                            width: 160,
                            child: Row(children: [
                              const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: _primary)),
                              const SizedBox(width: 8),
                              Text("screens.chat.post_loading".tr(), style: const TextStyle(fontSize: 12, color: _textSecondary)),
                            ]),
                          )
                        : _preview == null
                            ? Text("screens.chat.post_load_failed".tr(), style: const TextStyle(fontSize: 12, color: _textSecondary))
                            : Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(children: [
                                    const Icon(Icons.photo_camera_outlined, size: 14, color: _primary),
                                    const SizedBox(width: 4),
                                    Text("screens.chat.tourstar_post_badge".tr(), style: const TextStyle(fontSize: 10, color: _primary, fontWeight: FontWeight.w600)),
                                  ]),
                                  const SizedBox(height: 6),
                                  if (_preview!.thumbnailUrl.isNotEmpty)
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(8),
                                      child: Image.network(
                                        _preview!.thumbnailUrl,
                                        height: 120,
                                        width: double.infinity,
                                        fit: BoxFit.cover,
                                        errorBuilder: (_, _, _) => const SizedBox.shrink(),
                                      ),
                                    ),
                                  const SizedBox(height: 8),
                                  Text(
                                    _preview!.title,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: _textPrimary),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (_preview!.location.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Row(children: [
                                      const Icon(Icons.location_on_outlined, size: 12, color: _textSecondary),
                                      const SizedBox(width: 2),
                                      Expanded(
                                        child: Text(_preview!.location, style: const TextStyle(fontSize: 11, color: _textSecondary), overflow: TextOverflow.ellipsis),
                                      ),
                                    ]),
                                  ],
                                  const SizedBox(height: 6),
                                  Text("screens.chat.tap_to_view_post".tr(), style: const TextStyle(fontSize: 10, color: _primary)),
                                ],
                              ),
                  ),
                  const SizedBox(height: 2),
                  Text(widget.time, style: const TextStyle(fontSize: 10, color: _textSecondary)),
                ],
              ),
            ),
            if (widget.isMe) ...[
              const SizedBox(width: 8),
              CircleAvatar(
                radius: 16,
                backgroundColor: _primaryLight,
                child: Text(
                  "screens.chat.me".tr(),
                  style: const TextStyle(fontSize: 10, color: _primary, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _WhisperOverlay extends StatefulWidget {
  const _WhisperOverlay({
    required this.targetName,
    required this.targetId,
    required this.onSend,
    required this.onClose,
  });
  final String targetName;
  final String targetId;
  final Future<void> Function(String) onSend;
  final VoidCallback onClose;

  @override
  State<_WhisperOverlay> createState() => _WhisperOverlayState();
}

class _WhisperOverlayState extends State<_WhisperOverlay> {
  final _ctrl = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onClose,
      child: Container(
        color: Colors.black54,
        alignment: Alignment.center,
        child: GestureDetector(
          onTap: () {},
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 32),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.mail_outline, size: 20, color: _primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "screens.chat.whisper_to".tr(namedArgs: {"name": widget.targetName}),
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: _textPrimary,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      onPressed: widget.onClose,
                      icon: const Icon(Icons.close, size: 18, color: _textSecondary),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _ctrl,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: "screens.chat.hint_message".tr(),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _sending
                        ? null
                        : () async {
                            final text = _ctrl.text.trim();
                            if (text.isEmpty) return;
                            setState(() => _sending = true);
                            await widget.onSend(text);
                            setState(() => _sending = false);
                          },
                    style: FilledButton.styleFrom(backgroundColor: _primary),
                    child: Text(_sending ? "screens.chat.sending".tr() : "screens.chat.send_whisper".tr()),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// 개인톡 탭
// ═══════════════════════════════════════════════════════════════
class _WhisperTab extends ConsumerStatefulWidget {
  const _WhisperTab();

  @override
  ConsumerState<_WhisperTab> createState() => _WhisperTabState();
}

class _WhisperTabState extends ConsumerState<_WhisperTab> {
  bool _showCompose = false;
  final _toIdCtrl = TextEditingController();
  final _msgCtrl = TextEditingController();

  @override
  void dispose() {
    _toIdCtrl.dispose();
    _msgCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatControllerProvider);
    final ctrl = ref.read(chatControllerProvider.notifier);

    return Scaffold(
      backgroundColor: _bgPage,
      body: Stack(
        children: [
          Column(
            children: [
              // 탭 전환
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: _WhisperTabItem(
                        label: "screens.chat.tab_inbox".tr(),
                        count: state.inbox.length,
                        selected: state.whisperTab == WhisperTab.inbox,
                        onTap: () => ctrl.setWhisperTab(WhisperTab.inbox),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: _WhisperTabItem(
                        label: "screens.chat.tab_sent".tr(),
                        count: state.sent.length,
                        selected: state.whisperTab == WhisperTab.sent,
                        onTap: () => ctrl.setWhisperTab(WhisperTab.sent),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Row(
                  children: [
                    const Spacer(),
                    GestureDetector(
                      onTap: () {
                        ctrl.loadWhispers();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text("screens.chat.refreshing_snackbar".tr())),
                        );
                      },
                      child: Row(
                        children: [
                          const Icon(Icons.refresh, size: 14, color: _textSecondary),
                          const SizedBox(width: 4),
                          Text("screens.chat.refresh".tr(), style: const TextStyle(fontSize: 12, color: _textSecondary)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: _buildWhisperList(state),
              ),
            ],
          ),

          // 작성 오버레이
          if (_showCompose)
            _ComposeOverlay(
              toIdCtrl: _toIdCtrl,
              msgCtrl: _msgCtrl,
              sending: state.sending,
              onSend: () async {
                ctrl.setWhisperTargetUserIdText(_toIdCtrl.text.trim());
                ctrl.setWhisperInput(_msgCtrl.text.trim());
                await ctrl.sendWhisper();
                _toIdCtrl.clear();
                _msgCtrl.clear();
                setState(() => _showCompose = false);
              },
              onClose: () => setState(() => _showCompose = false),
            ),
        ],
      ),
      floatingActionButton: _showCompose
          ? null
          : FloatingActionButton(
              onPressed: () => setState(() => _showCompose = true),
              backgroundColor: _primary,
              child: const Icon(Icons.edit, color: Colors.white),
            ),
    );
  }

  Widget _buildWhisperList(ChatState state) {
    final items = state.whisperTab == WhisperTab.inbox ? state.inbox : state.sent;

    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text("📭", style: TextStyle(fontSize: 48)),
            const SizedBox(height: 12),
            Text(
              state.whisperTab == WhisperTab.inbox ? "screens.chat.inbox_empty".tr() : "screens.chat.sent_empty".tr(),
              style: const TextStyle(fontSize: 14, color: _textSecondary),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 80),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final msg = items[i];
        final isInbox = state.whisperTab == WhisperTab.inbox;
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 6,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _primaryLight,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      isInbox
                          ? "screens.chat.from_line".tr(namedArgs: {"name": msg.fromUsername ?? "screens.unknown".tr()})
                          : "screens.chat.to_line".tr(namedArgs: {"name": msg.toUsername ?? "screens.unknown".tr()}),
                      style: const TextStyle(fontSize: 11, color: _primary, fontWeight: FontWeight.w500),
                    ),
                  ),
                  const Spacer(),
                  if (msg.createdAt != null)
                    Text(
                      _formatDateTime(msg.createdAt!),
                      style: const TextStyle(fontSize: 11, color: _textSecondary),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                msg.message,
                style: const TextStyle(fontSize: 13, color: _textPrimary, height: 1.5),
              ),
            ],
          ),
        );
      },
    );
  }

  String _formatDateTime(DateTime dt) {
    return "${dt.month}/${dt.day} ${dt.hour.toString().padLeft(2, "0")}:${dt.minute.toString().padLeft(2, "0")}";
  }
}

class _WhisperTabItem extends StatelessWidget {
  const _WhisperTabItem({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: selected ? _primary : Colors.transparent,
              width: 2,
            ),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                color: selected ? _primary : _textSecondary,
              ),
            ),
            const SizedBox(width: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: selected ? _primary : Colors.grey.shade200,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                "$count",
                style: TextStyle(
                  fontSize: 11,
                  color: selected ? Colors.white : _textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ComposeOverlay extends StatelessWidget {
  const _ComposeOverlay({
    required this.toIdCtrl,
    required this.msgCtrl,
    required this.sending,
    required this.onSend,
    required this.onClose,
  });
  final TextEditingController toIdCtrl;
  final TextEditingController msgCtrl;
  final bool sending;
  final VoidCallback onSend;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onClose,
      child: Container(
        color: Colors.black54,
        alignment: Alignment.center,
        child: GestureDetector(
          onTap: () {},
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 24),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.mail, size: 20, color: _primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "screens.chat.compose_title".tr(),
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
                      ),
                    ),
                    IconButton(
                      onPressed: onClose,
                      icon: const Icon(Icons.close, size: 18, color: _textSecondary),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: toIdCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: "screens.chat.recipient_id_label".tr(),
                    hintText: "screens.chat.recipient_id_hint".tr(),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: msgCtrl,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: "screens.chat.message_body_hint".tr(),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: sending ? null : onSend,
                    style: FilledButton.styleFrom(backgroundColor: _primary),
                    child: Text(sending ? "screens.chat.sending".tr() : "screens.chat.send".tr()),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// (unused) _FriendTab removed
