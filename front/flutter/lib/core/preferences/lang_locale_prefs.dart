import "package:shared_preferences/shared_preferences.dart";

/// 웹 `langSlice.langPinnedByUser` — 사용자가 언어 선택기로 언어를 고정한 경우 프로필 국적으로 덮어쓰지 않습니다.
abstract final class LangLocalePrefs {
  static const _pinnedKey = "kroaddy_lang_pinned_by_user";

  static Future<bool> isLangPinnedByUser() async {
    final p = await SharedPreferences.getInstance();
    return p.getBool(_pinnedKey) ?? false;
  }

  static Future<void> setLangPinnedByUser(bool value) async {
    final p = await SharedPreferences.getInstance();
    await p.setBool(_pinnedKey, value);
  }
}
