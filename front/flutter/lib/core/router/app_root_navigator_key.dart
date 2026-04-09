import "package:flutter/material.dart";

/// `GoRouter` 루트 네비게이터 — 국적·프로필 기반 로케일 적용 시 `BuildContext` 없이 `setLocale` 호출에 사용합니다.
final appRootNavigatorKey = GlobalKey<NavigatorState>();
