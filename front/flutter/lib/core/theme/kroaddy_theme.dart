import "package:flutter/material.dart";
import "package:google_fonts/google_fonts.dart";

import "kroaddy_colors.dart";
import "kroaddy_radii.dart";

abstract final class KroaddyTheme {
  static ThemeData light() {
    final base = ThemeData(brightness: Brightness.light, useMaterial3: true);
    final scheme = ColorScheme.fromSeed(
      seedColor: KroaddyColors.primary,
      brightness: Brightness.light,
    ).copyWith(
      primary: KroaddyColors.primary,
      secondary: KroaddyColors.accent,
      surface: KroaddyColors.surfaceCard,
      onSurface: KroaddyColors.onSurfaceStrong,
      outline: KroaddyColors.outlineSoft,
    );

    final textTheme = GoogleFonts.notoSansKrTextTheme(base.textTheme).apply(
      bodyColor: KroaddyColors.onSurfaceStrong,
      displayColor: KroaddyColors.onSurfaceStrong,
    );

    return base.copyWith(
      colorScheme: scheme,
      scaffoldBackgroundColor: KroaddyColors.surfacePage,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: KroaddyColors.surfaceCard,
        foregroundColor: KroaddyColors.onSurfaceStrong,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
          color: KroaddyColors.onSurfaceStrong,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: KroaddyColors.surfaceCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(KroaddyRadii.lg),
          side: const BorderSide(color: KroaddyColors.outlineSoft),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: KroaddyColors.primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(KroaddyRadii.lg),
          ),
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: KroaddyColors.primary,
        linearTrackColor: KroaddyColors.brandWash,
      ),
    );
  }
}

