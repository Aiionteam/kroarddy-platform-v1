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
      title: "Kroaddy",
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: KroaddyTheme.light(),
    );
  }
}
