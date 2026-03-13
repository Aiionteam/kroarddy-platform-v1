import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../features/auth/presentation/state/auth_controller.dart";

final mainScaffoldKey = GlobalKey<ScaffoldState>();

class MainShell extends StatelessWidget {
  const MainShell({required this.child, super.key});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: mainScaffoldKey,
      drawer: const _AppDrawer(),
      body: child,
    );
  }
}

class _AppDrawer extends ConsumerWidget {
  const _AppDrawer();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).uri.path;

    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── 로고 헤더 ────────────────────────────────────────
            GestureDetector(
              onTap: () {
                Navigator.of(context).pop();
                context.go("/home");
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF9333EA), Color(0xFFEC4899)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Center(
                        child: Text(
                          "K",
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      "Kroaddy",
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF7C3AED),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const Divider(height: 1),
            const SizedBox(height: 8),

            // ── 카테고리 레이블 ──────────────────────────────────
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 4, 20, 6),
              child: Text(
                "카테고리",
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF9CA3AF),
                  letterSpacing: 0.5,
                ),
              ),
            ),

            // ── 메인 메뉴 항목 ───────────────────────────────────
            _DrawerItem(
              icon: Icons.auto_awesome_outlined,
              activeIcon: Icons.auto_awesome,
              label: "투어스타",
              path: "/tourstar",
              current: location,
            ),
            _DrawerItem(
              icon: Icons.calendar_today_outlined,
              activeIcon: Icons.calendar_today,
              label: "일정관리",
              path: "/planner/schedule",
              current: location,
            ),
            _DrawerItem(
              icon: Icons.map_outlined,
              activeIcon: Icons.map,
              label: "여행플래너",
              path: "/planner",
              current: location,
            ),
            _DrawerItem(
              icon: Icons.restaurant_outlined,
              activeIcon: Icons.restaurant,
              label: "맛집추천",
              path: "/guide/restaurant",
              current: location,
            ),
            _DrawerItem(
              icon: Icons.celebration_outlined,
              activeIcon: Icons.celebration,
              label: "행사추천",
              path: "/guide/event",
              current: location,
            ),
            _DrawerItem(
              icon: Icons.chat_bubble_outline,
              activeIcon: Icons.chat_bubble,
              label: "단체채팅",
              path: "/chat",
              current: location,
            ),

            const Spacer(),
            const Divider(height: 1),
            const SizedBox(height: 4),

            // ── 하단 메뉴 ────────────────────────────────────────
            _DrawerItem(
              icon: Icons.people_outline,
              activeIcon: Icons.people,
              label: "친구목록",
              path: "/chat/friends",
              current: location,
            ),
            _DrawerItem(
              icon: Icons.mail_outline,
              activeIcon: Icons.mail,
              label: "귓속말",
              path: "/chat/whisper",
              current: location,
            ),
            _DrawerItem(
              icon: Icons.settings_outlined,
              activeIcon: Icons.settings,
              label: "설정",
              path: "/profile",
              current: location,
            ),

            // ── 로그아웃 ────────────────────────────────────────
            ListTile(
              leading: const Icon(Icons.logout, color: Color(0xFFEF4444), size: 22),
              title: const Text(
                "로그아웃",
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFFEF4444),
                ),
              ),
              onTap: () async {
                Navigator.of(context).pop();
                await ref.read(authControllerProvider.notifier).logout();
                if (context.mounted) context.go("/login");
              },
              dense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 20),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _DrawerItem extends StatelessWidget {
  const _DrawerItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.path,
    required this.current,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String path;
  final String current;

  bool get _isActive => current == path || current.startsWith("$path/");

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        color: _isActive ? const Color(0xFFF3E8FF) : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
      ),
      child: ListTile(
        leading: Icon(
          _isActive ? activeIcon : icon,
          color: _isActive ? const Color(0xFF7C3AED) : const Color(0xFF6B7280),
          size: 22,
        ),
        title: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: _isActive ? FontWeight.w600 : FontWeight.w500,
            color: _isActive ? const Color(0xFF7C3AED) : const Color(0xFF374151),
          ),
        ),
        onTap: () {
          Navigator.of(context).pop();
          context.go(path);
        },
        dense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}
