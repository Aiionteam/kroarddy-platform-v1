import "package:flutter/widgets.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_naver_map/flutter_naver_map.dart";

import "app.dart";

const _naverMapClientId = String.fromEnvironment("NAVER_MAP_DYNAMIC_MAP_CLIENT_ID");

void _logNaverMapAuthFailed(NAuthFailedException ex) {
  // Log lines are ASCII-only so `adb logcat | findstr` on Windows does not mojibake UTF-8.
  debugPrint("[naver-map] auth failed: $ex");
  switch (ex) {
    case NUnauthorizedClientException():
      debugPrint(
        "[naver-map] hint 401: Use Client ID from NCP > Maps > Applications (Dynamic Map on). "
        "Register Android package exactly: site.kroaddy.kroaddy_app. "
        "Web/API-only keys may not work for the mobile map SDK.",
      );
    case NQuotaExceededException():
      debugPrint(
        "[naver-map] hint 429: Maps quota exceeded or Maps disabled for this application.",
      );
    case NClientUnspecifiedException():
      debugPrint(
        "[naver-map] hint 800: Client ID empty. Pass --dart-define=NAVER_MAP_DYNAMIC_MAP_CLIENT_ID=... when building.",
      );
    default:
      debugPrint("[naver-map] hint: other auth error (code: ${ex.code}).");
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (_naverMapClientId.isNotEmpty) {
    await FlutterNaverMap().init(
      clientId: _naverMapClientId,
      onAuthFailed: _logNaverMapAuthFailed,
    );
  } else {
    debugPrint(
      "[naver-map] NAVER_MAP_DYNAMIC_MAP_CLIENT_ID is empty. "
      "Run with --dart-define=NAVER_MAP_DYNAMIC_MAP_CLIENT_ID=... ",
    );
  }

  runApp(const ProviderScope(child: KroaddyApp()));
}
