import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "core/router/app_router.dart";
import "core/theme/kroaddy_theme.dart";

class KroaddyApp extends ConsumerWidget {
  const KroaddyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      key: ValueKey(context.locale.toString()),
      title: "Kroaddy",
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: KroaddyTheme.light(),
      localizationsDelegates: [
        ...context.localizationDelegates,
      ],
      supportedLocales: context.supportedLocales,
      locale: context.locale,
    );
  }
}
