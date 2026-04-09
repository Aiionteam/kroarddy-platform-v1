import "package:shared_preferences/shared_preferences.dart";

/// 웹 `sessionStorage` 의 `onboarding_skipped` 와 동일 — 나중에 온보딩하기 선택 시 홈 배너만 표시.
abstract final class OnboardingPrefs {
  static const _key = "onboarding_skipped";

  static Future<bool> isSkipped() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(_key) == "1";
  }

  static Future<void> setSkipped(bool value) async {
    final p = await SharedPreferences.getInstance();
    if (value) {
      await p.setString(_key, "1");
    } else {
      await p.remove(_key);
    }
  }

  static Future<void> clearSkipped() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(_key);
  }
}
