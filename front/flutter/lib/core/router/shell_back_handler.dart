import "package:flutter/foundation.dart";
import "package:flutter/services.dart";
import "package:go_router/go_router.dart";

/// Drawer 등에서 `context.go`만 쓰면 내부 스택이 비어 시스템 뒤로가기 시 앱이 바로 종료됨.
/// 상세·하위 경로는 부모 탭으로, 그 외는 홈으로 보냄.
String? shellBackTarget(String path) {
  if (path == "/home") return null;

  if (path.startsWith("/planner/k-content/")) {
    final suffix = path.substring("/planner/k-content/".length);
    if (suffix.isNotEmpty && !suffix.contains("/")) {
      return "/planner/k-content";
    }
  }
  if (path.startsWith("/tourstar/post/")) {
    return "/tourstar";
  }
  if (path == "/guide/event" || path == "/guide/restaurant") {
    return "/guide";
  }
  // 친구목록·귓속말은 `push` 스택 또는 이전 화면으로 돌아가야 하므로 여기서 /chat으로 고정하지 않음.
  if (path == "/profile/onboarding") {
    return "/profile";
  }
  return "/home";
}

/// `PopScope`는 반드시 [ModalRoute] 아래(예: ShellRoute builder)에 두어야 동작한다.
void handleShellBackButton(GoRouter router) {
  if (router.canPop()) {
    router.pop();
    return;
  }
  final path = router.state.uri.path;
  if (path == "/login") {
    if (!kIsWeb) SystemNavigator.pop();
    return;
  }
  final target = shellBackTarget(path);
  if (target != null) {
    router.go(target);
  } else {
    if (!kIsWeb) SystemNavigator.pop();
  }
}
