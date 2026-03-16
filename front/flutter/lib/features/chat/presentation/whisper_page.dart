import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/router/main_shell.dart";
import "state/chat_controller.dart";
import "state/chat_state.dart";

const _primary = Color(0xFF7C3AED);
const _primaryLight = Color(0xFFF3E8FF);
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _bgPage = Color(0xFFF8F7FF);

class WhisperPage extends ConsumerStatefulWidget {
  const WhisperPage({super.key});

  @override
  ConsumerState<WhisperPage> createState() => _WhisperPageState();
}

class _WhisperPageState extends ConsumerState<WhisperPage> {
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
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.menu, color: _textPrimary),
          onPressed: () => mainScaffoldKey.currentState?.openDrawer(),
        ),
        title: const Text(
          "귓속말",
          style: TextStyle(color: _textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
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
              Expanded(child: _buildWhisperList(state)),
            ],
          ),
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
              BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6, offset: const Offset(0, 1)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: _primaryLight, borderRadius: BorderRadius.circular(6)),
                    child: Text(
                      isInbox ? "From: ${msg.fromUsername ?? "알 수 없음"}" : "To: ${msg.toUsername ?? "알 수 없음"}",
                      style: const TextStyle(fontSize: 11, color: _primary, fontWeight: FontWeight.w500),
                    ),
                  ),
                  const Spacer(),
                  if (msg.createdAt != null)
                    Text(_formatDateTime(msg.createdAt!), style: const TextStyle(fontSize: 11, color: _textSecondary)),
                ],
              ),
              const SizedBox(height: 8),
              Text(msg.message, style: const TextStyle(fontSize: 13, color: _textPrimary, height: 1.5)),
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
  const _WhisperTabItem({required this.label, required this.count, required this.selected, required this.onTap});
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
          border: Border(bottom: BorderSide(color: selected ? _primary : Colors.transparent, width: 2)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(label, style: TextStyle(fontSize: 13, fontWeight: selected ? FontWeight.w600 : FontWeight.normal, color: selected ? _primary : _textSecondary)),
            const SizedBox(width: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: selected ? _primary : Colors.grey.shade200, borderRadius: BorderRadius.circular(10)),
              child: Text("$count", style: TextStyle(fontSize: 11, color: selected ? Colors.white : _textSecondary, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ComposeOverlay extends StatelessWidget {
  const _ComposeOverlay({required this.toIdCtrl, required this.msgCtrl, required this.sending, required this.onSend, required this.onClose});
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
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.mail, size: 20, color: _primary),
                    const SizedBox(width: 8),
                    const Expanded(child: Text("새 귓속말 보내기", style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary))),
                    IconButton(onPressed: onClose, icon: const Icon(Icons.close, size: 18, color: _textSecondary), padding: EdgeInsets.zero, constraints: const BoxConstraints(minWidth: 24, minHeight: 24)),
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
