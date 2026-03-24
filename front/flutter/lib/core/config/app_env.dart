class AppEnv {
  const AppEnv._();

  // Example:
  // flutter run --dart-define=API_BASE_URL=http://localhost:8080/api
  static const apiBaseUrl = String.fromEnvironment(
    "API_BASE_URL",
    defaultValue: "https://api.kroaddy.site/api",
  );

  // 웹 정적 리소스/Next API 베이스
  static const webBaseUrl = String.fromEnvironment(
    "WEB_BASE_URL",
    defaultValue: "https://web.kroaddy.site",
  );
}
