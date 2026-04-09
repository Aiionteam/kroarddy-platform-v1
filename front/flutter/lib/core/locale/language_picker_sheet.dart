import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";

import "../preferences/lang_locale_prefs.dart";

/// 웹 i18n과 동일하게 앱 표시 언어를 전환합니다. (easy_localization + SharedPreferences)
void showAppLanguagePicker(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (ctx) {
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: Text(
                "common.language".tr(),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            ListTile(
              leading: const Text("🇰🇷", style: TextStyle(fontSize: 22)),
              title: const Text("한국어"),
              trailing: context.locale.languageCode == "ko"
                  ? const Icon(Icons.check, color: Color(0xFF4F46E5))
                  : null,
              onTap: () async {
                await LangLocalePrefs.setLangPinnedByUser(true);
                if (!ctx.mounted) return;
                await ctx.setLocale(const Locale("ko"));
                if (!ctx.mounted) return;
                Navigator.of(ctx).pop();
              },
            ),
            ListTile(
              leading: const Text("🇺🇸", style: TextStyle(fontSize: 22)),
              title: const Text("English"),
              trailing: context.locale.languageCode == "en"
                  ? const Icon(Icons.check, color: Color(0xFF4F46E5))
                  : null,
              onTap: () async {
                await LangLocalePrefs.setLangPinnedByUser(true);
                if (!ctx.mounted) return;
                await ctx.setLocale(const Locale("en"));
                if (!ctx.mounted) return;
                Navigator.of(ctx).pop();
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      );
    },
  );
}
