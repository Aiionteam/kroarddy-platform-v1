import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/theme/kroaddy_colors.dart";
import "../../../core/theme/kroaddy_radii.dart";
import "state/auth_controller.dart";

class LoginPage extends ConsumerWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(authControllerProvider);
    final controller = ref.read(authControllerProvider.notifier);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 36),
              Image.asset(
                "assets/branding/kroaddy_logo_white.png",
                width: 260,
                fit: BoxFit.contain,
              ),
              const SizedBox(height: 28),

              // ── Status / Loading ──
              if (state.loading)
                const Padding(
                  padding: EdgeInsets.only(bottom: 18),
                  child: LinearProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(
                      KroaddyColors.primary,
                    ),
                    backgroundColor: KroaddyColors.brandWash,
                    minHeight: 3,
                  ),
                ),
              if (state.message.isNotEmpty && !state.loading)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: KroaddyColors.selectionWash,
                    borderRadius: BorderRadius.circular(KroaddyRadii.md),
                    border: Border.all(
                      color: KroaddyColors.primary.withValues(alpha: 0.10),
                    ),
                  ),
                  child: Text(
                    state.message,
                    style: const TextStyle(
                      fontSize: 13,
                      color: KroaddyColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),

              // ── Login Buttons (Cloud) ──
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
                onTap: state.loading ? null : () => controller.signIn("naver"),
              ),
              const SizedBox(height: 12),
              _OAuthButton(
                label: "Google로 로그인",
                icon: Icons.g_mobiledata_rounded,
                backgroundColor: Colors.white,
                textColor: const Color(0xFF1F2937),
                iconColor: const Color(0xFF4285F4),
                border: Border.all(color: const Color(0xFFE5E7EB)),
                onTap: state.loading ? null : () => controller.signIn("google"),
              ),

              const SizedBox(height: 28),
              Text(
                "로그인 시 서비스 이용약관 및 개인정보처리방침에\n동의하는 것으로 간주됩니다.",
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.grey.shade400,
                  height: 1.6,
                ),
              ),
              const SizedBox(height: 12),
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
            borderRadius: BorderRadius.circular(KroaddyRadii.md),
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
                  fontWeight: FontWeight.w700,
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
