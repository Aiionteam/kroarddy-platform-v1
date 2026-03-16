import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/router/main_shell.dart";
import "../data/chat_models.dart";
import "state/chat_controller.dart";
import "state/chat_state.dart";

// ── 색상 상수 ─────────────────────────────────────────────────
const _primary = Color(0xFF7C3AED);
const _primaryLight = Color(0xFFF3E8FF);
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _bgPage = Color(0xFFF8F7FF);
const _myBubble = Color(0xFF7C3AED);
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
        title: const Text(
          "단체채팅",
          style: TextStyle(color: _textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
      body: const _GroupChatTab(),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// 단체채팅 탭
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
      (_, __) => _scrollToBottom(),
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
                const Text(
                  "단체채팅방",
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _textPrimary),
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
                      state.message.contains("실패") || state.message.contains("인증")
                          ? state.message
                          : "채팅방을 불러올 수 없습니다.",
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 14, color: _textSecondary),
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton.icon(
                      onPressed: ctrl.loadRooms,
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text("다시 시도"),
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
                  const Text(
                    "명예도에 따라 입장 가능한 방이 달라집니다.",
                    style: TextStyle(fontSize: 12, color: _textSecondary),
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
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: _tierColor(state.selectedRoomType),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              "${_tierLabel(state.selectedRoomType ?? "")} 채팅방",
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
                    ? const Center(
                        child: Text("메시지가 없습니다.", style: TextStyle(color: _textSecondary)),
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
                            hintText: "메시지를 입력하세요",
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

          // 귓속말 다이얼로그
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
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                room.label.substring(0, 1),
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  room.label,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  minHonor > 0 ? "최소 명예도 $minHonor 이상" : "누구나 입장 가능",
                  style: TextStyle(fontSize: 12, color: minHonor > 0 ? color : const Color(0xFF059669)),
                ),
              ],
            ),
          ),
          FilledButton(
            onPressed: room.accessible ? onEnter : null,
            style: FilledButton.styleFrom(
              backgroundColor: room.accessible ? color : Colors.grey.shade200,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            ),
            child: Text(
              room.accessible ? "입장" : "명예도 부족",
              style: TextStyle(
                fontSize: 12,
                color: room.accessible ? Colors.white : _textSecondary,
              ),
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
                child: const Text(
                  "나",
                  style: TextStyle(fontSize: 10, color: _primary, fontWeight: FontWeight.bold),
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
                        "${widget.targetName}에게 귓속말",
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
                    hintText: "귓속말 내용을 입력하세요",
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
                    child: Text(_sending ? "전송 중..." : "귓속말 보내기"),
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
// 귓속말 탭
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
                        label: "받은 귓속말",
                        count: state.inbox.length,
                        selected: state.whisperTab == WhisperTab.inbox,
                        onTap: () => ctrl.setWhisperTab(WhisperTab.inbox),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: _WhisperTabItem(
                        label: "보낸 귓속말",
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
                          const SnackBar(content: Text("새로고침 중...")),
                        );
                      },
                      child: const Row(
                        children: [
                          Icon(Icons.refresh, size: 14, color: _textSecondary),
                          SizedBox(width: 4),
                          Text("새로고침", style: TextStyle(fontSize: 12, color: _textSecondary)),
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
              state.whisperTab == WhisperTab.inbox ? "받은 귓속말이 없습니다." : "보낸 귓속말이 없습니다.",
              style: const TextStyle(fontSize: 14, color: _textSecondary),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 80),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
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
                          ? "From: ${msg.fromUsername ?? "알 수 없음"}"
                          : "To: ${msg.toUsername ?? "알 수 없음"}",
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
                    const Expanded(
                      child: Text(
                        "새 귓속말 보내기",
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
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
                    labelText: "받는 사람 ID",
                    hintText: "채팅에서 메시지를 길게 눌러 귓속말",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: msgCtrl,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: "내용을 입력하세요",
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
                    child: Text(sending ? "전송 중..." : "보내기"),
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
// 친구 탭
// ═══════════════════════════════════════════════════════════════
class _FriendTab extends ConsumerWidget {
  const _FriendTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: _bgPage,
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 안내
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _primaryLight,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline, size: 16, color: _primary),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    "단체채팅에서 메시지를 길게 눌러 귓속말 보내기, 명예도 부여, 친구추가를 할 수 있어요.",
                    style: TextStyle(fontSize: 12, color: _primary, height: 1.5),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // 명예도 시스템 설명
          const Text(
            "명예도 등급 시스템",
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
          ),
          const SizedBox(height: 12),
          ...const [
            ("SILVER", "0+", Color(0xFF9CA3AF), "누구나 입장 가능"),
            ("GOLD", "100+", Color(0xFFF59E0B), "골드 채팅방 입장"),
            ("PLATINUM", "500+", Color(0xFF06B6D4), "플래티넘 채팅방 입장"),
            ("DIAMOND", "1000+", Color(0xFF3B82F6), "다이아몬드 채팅방 입장"),
          ].map(
            (t) => Container(
              margin: const EdgeInsets.only(bottom: 8),
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
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: t.$3.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      t.$1,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: t.$3,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "명예도 ${t.$2}",
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: _textPrimary,
                          ),
                        ),
                        Text(
                          t.$4,
                          style: const TextStyle(fontSize: 12, color: _textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFBBF7D0)),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "💡 명예도를 올리는 방법",
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF065F46)),
                ),
                SizedBox(height: 6),
                Text(
                  "다른 유저가 채팅에서 내 메시지를 꾹 누르면 명예도를 올리거나 내릴 수 있어요. 좋은 정보와 예의 바른 대화로 명예도를 높여보세요!",
                  style: TextStyle(fontSize: 12, color: Color(0xFF047857), height: 1.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
