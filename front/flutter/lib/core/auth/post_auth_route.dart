import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../features/profile/data/profile_repository.dart";
import "../network/api_client.dart";
import "../preferences/onboarding_prefs.dart";
import "jwt_claims.dart";

/// OAuth 직후·세션 복원 직후 — 웹 `login/callback` 과 동일하게 여행 프로필 완성 여부로 분기합니다.
Future<String> resolvePostLoginRoute(Ref ref) async {
  final tokenStore = ref.read(tokenStoreProvider);
  final token = await tokenStore.readAccessToken();
  if (token == null || token.isEmpty) return "/login";

  final appUserId = getAppUserIdFromToken(token);
  if (appUserId == null) return "/home";

  try {
    final profile = await ref.read(profileRepositoryProvider).fetchTravelProfile(appUserId);
    final skipped = await OnboardingPrefs.isSkipped();
    if (profile == null || !profile.isComplete) {
      if (!skipped) return "/profile/onboarding";
    }
  } catch (_) {
    // 웹: 프로필 조회 실패 시에도 홈으로
  }
  return "/home";
}
