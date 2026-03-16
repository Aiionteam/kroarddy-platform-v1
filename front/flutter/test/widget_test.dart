import "package:flutter_test/flutter_test.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "package:kroaddy_app/app.dart";

void main() {
  testWidgets("앱이 초기 라우트를 렌더링한다", (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(child: KroaddyApp()),
    );
    await tester.pumpAndSettle();

    expect(find.text("투어스타"), findsOneWidget);
  });
}
