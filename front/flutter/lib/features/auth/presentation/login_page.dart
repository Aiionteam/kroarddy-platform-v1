import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "state/auth_controller.dart";

class LoginPage extends ConsumerWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(authControllerProvider);
    final controller = ref.read(authControllerProvider.notifier);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F7FF),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 48),
              // ── Logo ──
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF9333EA), Color(0xFFEC4899)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF9333EA).withValues(alpha: 0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Center(
                  child: Text(
                    "K",
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                "Kroaddy",
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1F2937),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                "여행을 더 특별하게 기록하세요",
                style: TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 48),
              // ── Status / Loading ──
              if (state.loading)
                const Padding(
                  padding: EdgeInsets.only(bottom: 20),
                  child: LinearProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF9333EA)),
                    backgroundColor: Color(0xFFF3E8FF),
                    minHeight: 3,
                  ),
                ),
              if (state.message.isNotEmpty && !state.loading)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 20),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF3E8FF),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    state.message,
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF7C3AED),
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              // ── Login Buttons ──
              _OAuthButton(
                label: "카카오로 로그인",
                icon: Icons.chat_bubble_rounded,
                backgroundColor: const Color(0xFFFEE500),
                textColor: const Color(0xFF191919),
                iconColor: const Color(0xFF191919),
                onTap: state.loading ? null : () => controller.signIn("kakao"),
              ),
              const SizedBox(height: 12),
              _OAuthButton(
                label: "네이버로 로그인",
                icon: Icons.search_rounded,
                backgroundColor: const Color(0xFF03C75A),
                textColor: Colors.white,
                iconColor: Colors.white,
                onTap:
                    state.loading ? null : () => controller.signIn("naver"),
              ),
              const SizedBox(height: 12),
              _OAuthButton(
                label: "Google로 로그인",
                icon: Icons.g_mobiledata_rounded,
                backgroundColor: Colors.white,
                textColor: const Color(0xFF1F2937),
                iconColor: const Color(0xFF4285F4),
                border: Border.all(color: const Color(0xFFE5E7EB)),
                onTap:
                    state.loading ? null : () => controller.signIn("google"),
              ),
              const SizedBox(height: 48),
              Text(
                "로그인 시 서비스 이용약관 및 개인정보처리방침에\n동의하는 것으로 간주됩니다.",
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.grey.shade400,
                  height: 1.6,
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

class _OAuthButton extends StatelessWidget {
  const _OAuthButton({
    required this.label,
    required this.icon,
    required this.backgroundColor,
    required this.textColor,
    required this.iconColor,
    this.border,
    this.onTap,
  });

  final String label;
  final IconData icon;
  final Color backgroundColor;
  final Color textColor;
  final Color iconColor;
  final BoxBorder? border;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.6 : 1.0,
        child: Container(
          height: 54,
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(14),
            border: border,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: iconColor, size: 22),
              const SizedBox(width: 10),
              Text(
                label,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: textColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
