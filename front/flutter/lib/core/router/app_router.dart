import "package:flutter/foundation.dart";
import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../features/auth/presentation/login_page.dart";
import "../../features/auth/presentation/state/auth_controller.dart";
import "../../features/customer/presentation/customer_center_page.dart";
import "../../features/customer/presentation/customer_emergency_page.dart";
import "../../features/customer/presentation/customer_guide_page.dart";
import "../../features/customer/presentation/customer_inquiry_page.dart";
import "../../features/customer/presentation/customer_notices_page.dart";
import "../../features/customer/presentation/customer_subscription_page.dart";
import "../../features/chat/presentation/chat_page.dart";
import "../../features/chat/presentation/friends_page.dart";
import "../../features/chat/presentation/whisper_page.dart";
import "../../features/guide/presentation/guide_explore_page.dart";
import "../../features/home/home_page.dart";
import "../../features/planner/presentation/planner_page.dart";
import "../../features/planner/presentation/k_content_package_page.dart";
import "../../features/planner/presentation/schedule_page.dart";
import "../../features/profile/presentation/onboarding_page.dart";
import "../../features/profile/presentation/profile_page.dart";
import "../../features/tourstar/presentation/tourstar_page.dart";
import "../auth/post_auth_route.dart";
import "../theme/kroaddy_colors.dart";
import "app_root_navigator_key.dart";
import "main_shell.dart";
import "shell_back_handler.dart";

final appRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    navigatorKey: appRootNavigatorKey,
    initialLocation: "/login",
    redirect: (context, state) {
      if (state.uri.path == "/") return "/login";
      return null;
    },
    errorBuilder: (context, state) => const Scaffold(
      backgroundColor: Color(0xFFF8F7FF),
      body: Center(child: CircularProgressIndicator(color: KroaddyColors.primary)),
    ),
    routes: [
      GoRoute(
        path: "/login",
        builder: (context, state) => PopScope(
          canPop: false,
          onPopInvokedWithResult: (bool didPop, Object? result) {
            if (didPop) return;
            if (!kIsWeb) SystemNavigator.pop();
          },
          child: const LoginPage(),
        ),
      ),
      ShellRoute(
        builder: (context, state, child) => PopScope(
          canPop: false,
          onPopInvokedWithResult: (bool didPop, Object? result) {
            if (didPop) return;
            handleShellBackButton(GoRouter.of(context));
          },
          child: MainShell(child: child),
        ),
        routes: [
          GoRoute(
            path: "/home",
            builder: (context, state) => const HomePage(),
          ),
          GoRoute(
            path: "/tourstar",
            builder: (context, state) {
              final postId = state.uri.queryParameters["postId"];
              final authorIdStr = state.uri.queryParameters["authorUserId"];
              final authorUserId = int.tryParse(authorIdStr ?? "");
              final authorName = state.uri.queryParameters["authorName"];
              return TourstarPage(
                initialPostId: postId,
                initialAuthorUserId: authorUserId,
                initialAuthorName: authorName,
              );
            },
            routes: [
              GoRoute(
                path: "post/:postId",
                builder: (context, state) {
                  final postId = state.pathParameters["postId"];
                  return TourstarPage(initialPostId: postId);
                },
              ),
            ],
          ),
          GoRoute(
            path: "/planner",
            builder: (context, state) => const PlannerPage(),
          ),
          GoRoute(
            path: "/planner/k-content",
            builder: (context, state) => const PlannerPage(initialTabIndex: 2),
          ),
          GoRoute(
            path: "/planner/k-content/:packageId",
            builder: (context, state) {
              final packageId = state.pathParameters["packageId"] ?? "";
              return KContentPackagePage(packageId: packageId);
            },
          ),
          GoRoute(
            path: "/planner/schedule",
            builder: (context, state) => const SchedulePage(),
          ),
          GoRoute(
            path: "/guide",
            builder: (context, state) => const GuideExplorePage(),
          ),
          GoRoute(
            path: "/guide/event",
            redirect: (context, state) => "/guide",
          ),
          GoRoute(
            path: "/guide/restaurant",
            redirect: (context, state) => "/guide",
          ),
          GoRoute(
            path: "/chat",
            builder: (context, state) => const ChatPage(),
          ),
          GoRoute(
            path: "/chat/friends",
            builder: (context, state) => const FriendsPage(),
          ),
          GoRoute(
            path: "/chat/whisper",
            builder: (context, state) => const WhisperPage(),
          ),
          GoRoute(
            path: "/profile",
            builder: (context, state) => const ProfilePage(),
          ),
          GoRoute(
            path: "/profile/onboarding",
            builder: (context, state) => const OnboardingPage(),
          ),
          GoRoute(
            path: "/customer",
            builder: (context, state) => const CustomerCenterPage(),
            routes: [
              GoRoute(
                path: "guide",
                builder: (context, state) => const CustomerGuidePage(),
              ),
              GoRoute(
                path: "inquiry",
                builder: (context, state) => const CustomerInquiryPage(),
              ),
              GoRoute(
                path: "notices",
                builder: (context, state) => const CustomerNoticesPage(),
              ),
              GoRoute(
                path: "subscription",
                builder: (context, state) => const CustomerSubscriptionPage(),
              ),
              GoRoute(
                path: "emergency",
                builder: (context, state) => const CustomerEmergencyPage(),
              ),
            ],
          ),
        ],
      ),
    ],
  );

  ref.listen<String?>(
    authControllerProvider.select((s) => s.accessToken),
    (previous, next) {
      if (next != null && next.isNotEmpty) {
        Future.microtask(() async {
          final route = await resolvePostLoginRoute(ref);
          router.go(route);
        });
        return;
      }
      if (next == null || next.isEmpty) {
        final path = router.state.uri.path;
        if (path != "/login") {
          router.go("/login");
        }
      }
    },
  );

  return router;
});
