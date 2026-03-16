import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../core/router/main_shell.dart";

const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _bgPage = Color(0xFFF8F7FF);

class GuideLandingPage extends StatelessWidget {
  const GuideLandingPage({super.key});

  static const _options = [
    _GuideOption(
      emoji: "🍜",
      label: "맛집 추천",
      description: "지역별 맛집 탐색",
      path: "/guide/restaurant",
      color: Color(0xFFD97706),
      bg: Color(0xFFFEF3C7),
    ),
    _GuideOption(
      emoji: "🎪",
      label: "행사 추천",
      description: "전국 문화 축제 캘린더",
      path: "/guide/event",
      color: Color(0xFFDB2777),
      bg: Color(0xFFFCE7F3),
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
          "장소 추천",
          style: TextStyle(
            color: _textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 8),
            Text(
              "맛집과 행사를 한 화면에서 선택해서 살펴보세요.",
              style: TextStyle(fontSize: 14, color: _textSecondary),
            ),
            const SizedBox(height: 24),
            Row(
              children: _options
                  .map(
                    (opt) => Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(
                          right: opt == _options.first ? 8 : 0,
                          left: opt == _options.last ? 8 : 0,
                        ),
                        child: _GuideOptionCard(option: opt),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }
}

class _GuideOption {
  const _GuideOption({
    required this.emoji,
    required this.label,
    required this.description,
    required this.path,
    required this.color,
    required this.bg,
  });

  final String emoji;
  final String label;
  final String description;
  final String path;
  final Color color;
  final Color bg;
}

class _GuideOptionCard extends StatelessWidget {
  const _GuideOptionCard({required this.option});
  final _GuideOption option;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go(option.path),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE5E7EB)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: option.bg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(option.emoji, style: const TextStyle(fontSize: 24)),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              option.label,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: _textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              option.description,
              style: const TextStyle(
                fontSize: 12,
                color: _textSecondary,
                height: 1.3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
