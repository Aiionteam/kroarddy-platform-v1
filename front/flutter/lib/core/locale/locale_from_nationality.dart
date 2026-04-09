import "dart:async";

import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:flutter/scheduler.dart";

import "../preferences/lang_locale_prefs.dart";
import "../router/app_root_navigator_key.dart";
import "nationality_locale.dart";

/// 웹 `setLangByNationality` 와 동일한 규칙으로 `easy_localization` 로케일을 맞춥니다.
abstract final class LocaleFromNationality {
  static Future<void> apply(
    String nationality, {
    required bool fromSavedProfile,
  }) async {
    final pinned = await LangLocalePrefs.isLangPinnedByUser();
    if (fromSavedProfile && pinned) return;

    final code = languageCodeForNationality(nationality);

    Future<void> setOn(BuildContext ctx) async {
      if (!ctx.mounted) return;
      await ctx.setLocale(Locale(code));
    }

    final ctx = appRootNavigatorKey.currentContext;
    if (ctx != null && ctx.mounted) {
      await setOn(ctx);
    } else {
      final done = Completer<void>();
      SchedulerBinding.instance.addPostFrameCallback((_) async {
        final c = appRootNavigatorKey.currentContext;
        if (c != null && c.mounted) await setOn(c);
        done.complete();
      });
      await done.future;
    }

    if (!fromSavedProfile) {
      await LangLocalePrefs.setLangPinnedByUser(true);
    }
  }
}
