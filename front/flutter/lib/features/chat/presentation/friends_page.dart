import "package:flutter/material.dart";

import "../../../core/router/main_shell.dart";

const _primary = Color(0xFF7C3AED);
const _primaryLight = Color(0xFFF3E8FF);
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _bgPage = Color(0xFFF8F7FF);

class FriendsPage extends StatelessWidget {
  const FriendsPage({super.key});

  @override
  Widget build(BuildContext context) {
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
          "친구목록",
          style: TextStyle(color: _textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
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

          // 명예도 등급 시스템
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
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: t.$3),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "명예도 ${t.$2}",
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _textPrimary),
                        ),
                        Text(t.$4, style: const TextStyle(fontSize: 12, color: _textSecondary)),
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
