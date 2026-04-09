import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../locale/locale_from_nationality.dart";
import "../theme/kroaddy_colors.dart";
import "../../features/auth/presentation/state/auth_controller.dart";
import "../../features/profile/data/profile_repository.dart";

final mainScaffoldKey = GlobalKey<ScaffoldState>();

class MainShell extends ConsumerStatefulWidget {
  const MainShell({required this.child, super.key});
  final Widget child;

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncLocaleFromSavedProfile());
  }

  /// 웹 `useAutoLocaleFromProfile` 과 같이, 로그인 후 저장된 국적으로 언어를 한 번 맞춥니다.
  Future<void> _syncLocaleFromSavedProfile() async {
    try {
      final repo = ref.read(profileRepositoryProvider);
      final ids = await repo.resolveIds();
      final travel = await repo.fetchTravelProfile(ids.$2);
      if (!mounted) return;
      await LocaleFromNationality.apply(
        travel?.nationality ?? "",
        fromSavedProfile: true,
      );
    } catch (_) {
      // 토큰 없음·API 실패 시 기존 로케일 유지
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: mainScaffoldKey,
      drawer: const _AppDrawer(),
      body: widget.child,
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
                    Image.asset(
                      "assets/branding/kroaddy_logo_white.png",
                      height: 44,
                      fit: BoxFit.contain,
                    ),
                  ],
                ),
              ),
            ),
            const Divider(height: 1),
            const SizedBox(height: 8),

            // ── 카테고리 레이블 ──────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 6),
              child: Text(
                "sidebar.section_category".tr(),
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF9CA3AF),
                  letterSpacing: 0.5,
                ),
              ),
            ),

            // ── 메인 메뉴 항목 ───────────────────────────────────
            _DrawerItem(
              label: "sidebar.guide".tr(),
              path: "/guide",
              current: location,
              leadingAsset: "icons/sidebar/jangso.png",
            ),
            _DrawerItem(
              label: "sidebar.tourstar".tr(),
              path: "/tourstar",
              current: location,
              leadingAsset: "icons/sidebar/feed.png",
            ),
            _DrawerItem(
              label: "sidebar.planner".tr(),
              path: "/planner",
              excludePrefixes: const ["/planner/schedule"],
              current: location,
              leadingAsset: "icons/sidebar/planner.png",
            ),
            _DrawerItem(
              label: "sidebar.schedule".tr(),
              path: "/planner/schedule",
              current: location,
              leadingAsset: "icons/sidebar/myplan.png",
            ),
            _DrawerItem(
              label: "sidebar.groupchat".tr(),
              path: "/chat",
              // 하단 메뉴(/chat/friends, /chat/whisper)에서는 그룹톡이 선택되지 않게 제외
              excludePrefixes: const ["/chat/friends", "/chat/whisper"],
              current: location,
              leadingAsset: "icons/sidebar/grouptalk.png",
            ),
            _DrawerItem(
              label: "sidebar.whisper".tr(),
              path: "/chat/whisper",
              current: location,
              leadingAsset: "icons/sidebar/talk.png",
            ),

            const Spacer(),
            const Divider(height: 1),
            const SizedBox(height: 4),
            // ── 하단 메뉴 ────────────────────────────────────────
            _DrawerItem(
              icon: Icons.people_outline,
              activeIcon: Icons.people,
              label: "sidebar.friends".tr(),
              path: "/chat/friends",
              current: location,
            ),
            _DrawerItem(
              icon: Icons.support_agent_outlined,
              activeIcon: Icons.support_agent,
              label: "sidebar.customer".tr(),
              path: "/customer",
              current: location,
            ),
            _DrawerItem(
              icon: Icons.settings_outlined,
              activeIcon: Icons.settings,
              label: "sidebar.settings_short".tr(),
              path: "/profile",
              current: location,
            ),

            // ── 로그아웃 ────────────────────────────────────────
            ListTile(
              leading: const Icon(Icons.logout, color: Color(0xFFEF4444), size: 22),
              title: Text(
                "common.logout".tr(),
                style: const TextStyle(
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
    required this.label,
    required this.path,
    required this.current,
    this.icon,
    this.activeIcon,
    this.leadingAsset,
    this.excludePrefixes = const [],
  }) : assert(
          leadingAsset != null || (icon != null && activeIcon != null),
          "Drawer item needs leadingAsset or both icon and activeIcon",
        );

  final IconData? icon;
  final IconData? activeIcon;
  final String? leadingAsset;
  final String label;
  final String path;
  final String current;
  final List<String> excludePrefixes;

  bool get _isActive {
    if (excludePrefixes.any((p) => current.startsWith(p))) return false;
    return current == path || current.startsWith("$path/");
  }

  Widget _leading() {
    final activeColor = KroaddyColors.primary;
    final inactiveColor = const Color(0xFF6B7280);
    if (leadingAsset != null) {
      return ColorFiltered(
        colorFilter: ColorFilter.mode(
          _isActive ? activeColor : inactiveColor,
          BlendMode.srcIn,
        ),
        child: Image.asset(
          leadingAsset!,
          width: 22,
          height: 22,
          fit: BoxFit.contain,
        ),
      );
    }
    return Icon(
      _isActive ? activeIcon! : icon!,
      color: _isActive ? activeColor : inactiveColor,
      size: 22,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        color: _isActive ? KroaddyColors.brandWash : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
      ),
      child: ListTile(
        leading: _leading(),
        title: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: _isActive ? FontWeight.w600 : FontWeight.w500,
            color: _isActive ? KroaddyColors.primary : const Color(0xFF374151),
          ),
        ),
        onTap: () {
          Navigator.of(context).pop();
          final loc = GoRouterState.of(context).uri.path;
          if (loc == path) return;
          context.push(path);
        },
        dense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}
