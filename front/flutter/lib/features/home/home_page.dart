import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../core/router/main_shell.dart";

const _primary = Color(0xFF7C3AED);
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _bgPage = Color(0xFFF8F7FF);

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  static const _quickLinks = [
    _QuickLink(
      emoji: "🗺️",
      label: "여행플래너",
      desc: "AI가 추천하는 여행 루트와 일정",
      path: "/planner",
      color: Color(0xFF7C3AED),
      bg: Color(0xFFF3E8FF),
    ),
    _QuickLink(
      emoji: "📋",
      label: "일정관리",
      desc: "저장된 내 여행 플랜 보기",
      path: "/planner/schedule",
      color: Color(0xFF4F46E5),
      bg: Color(0xFFEEF2FF),
    ),
    _QuickLink(
      emoji: "🎪",
      label: "행사추천",
      desc: "전국 문화 축제 캘린더",
      path: "/guide/event",
      color: Color(0xFFDB2777),
      bg: Color(0xFFFCE7F3),
    ),
    _QuickLink(
      emoji: "🍜",
      label: "맛집추천",
      desc: "지역별 맛집 탐색",
      path: "/guide/restaurant",
      color: Color(0xFFD97706),
      bg: Color(0xFFFEF3C7),
    ),
  ];

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
          "Kroaddy",
          style: TextStyle(
            color: _primary,
            fontWeight: FontWeight.bold,
            fontSize: 20,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 8),
            // ── 웰컴 배너 ──────────────────────────────────────
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF7C3AED), Color(0xFF9333EA)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "Kroaddy",
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    "AI와 함께 나만의 여행을 만들어보세요",
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.85),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ── 퀵링크 그리드 ──────────────────────────────────
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.1,
              ),
              itemCount: _quickLinks.length,
              itemBuilder: (context, i) {
                final link = _quickLinks[i];
                return _QuickLinkCard(link: link);
              },
            ),
            const SizedBox(height: 24),

            // ── 투어스타 바로가기 ───────────────────────────────
            GestureDetector(
              onTap: () => context.go("/tourstar"),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 10,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF9333EA), Color(0xFFEC4899)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Center(
                        child: Text("✨", style: TextStyle(fontSize: 22)),
                      ),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "투어스타",
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: _textPrimary,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            "AI가 여행 사진을 분석하고 여행기록을 남겨드려요",
                            style: TextStyle(
                              fontSize: 12,
                              color: _textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.arrow_forward_ios, size: 14, color: _textSecondary),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickLink {
  const _QuickLink({
    required this.emoji,
    required this.label,
    required this.desc,
    required this.path,
    required this.color,
    required this.bg,
  });

  final String emoji;
  final String label;
  final String desc;
  final String path;
  final Color color;
  final Color bg;
}

class _QuickLinkCard extends StatelessWidget {
  const _QuickLinkCard({required this.link});
  final _QuickLink link;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go(link.path),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: link.bg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(link.emoji, style: const TextStyle(fontSize: 22)),
              ),
            ),
            const Spacer(),
            Text(
              link.label,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: _textPrimary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              link.desc,
              style: const TextStyle(
                fontSize: 11,
                color: _textSecondary,
                height: 1.3,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
