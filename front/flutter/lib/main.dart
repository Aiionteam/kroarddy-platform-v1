import "package:flutter/widgets.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_naver_map/flutter_naver_map.dart";

import "app.dart";

const _naverMapClientId = String.fromEnvironment("NAVER_MAP_DYNAMIC_MAP_CLIENT_ID");

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (_naverMapClientId.isNotEmpty) {
    await FlutterNaverMap().init(
      clientId: _naverMapClientId,
      onAuthFailed: (ex) {
        // 앱 동작을 막지는 않되, 지도는 초기화 실패할 수 있음
        // ignore: avoid_print
        print("[naver-map] auth failed: $ex");
      },
    );
  } else {
    // ignore: avoid_print
    print(
      "[naver-map] NAVER_MAP_DYNAMIC_MAP_CLIENT_ID is empty. "
      "Run with --dart-define=NAVER_MAP_DYNAMIC_MAP_CLIENT_ID=... ",
    );
  }

  runApp(const ProviderScope(child: KroaddyApp()));
}
