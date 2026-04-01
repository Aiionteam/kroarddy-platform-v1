/// 채팅 메시지 본문에서 투어스타 게시글 ID를 추출하는 유틸리티.
///
/// 지원 URL 형식:
///   - https://web.kroaddy.site/tourstar?postId=xxx
///   - https://web.kroaddy.site/tourstar/post/xxx
class TourstarShareParser {
  TourstarShareParser._();

  static final _queryPattern = RegExp(
    r'https?://web\.kroaddy\.site/tourstar(?:/[^\s?#]*)?[?&]postId=([^\s&]+)',
    caseSensitive: false,
  );

  static final _pathPattern = RegExp(
    r'https?://web\.kroaddy\.site/tourstar/post/([^\s/?#]+)',
    caseSensitive: false,
  );

  /// 메시지에서 투어스타 URL이 포함된 경우 [postId]를 반환한다.
  /// 없으면 `null` 반환.
  static String? extractPostId(String message) {
    final q = _queryPattern.firstMatch(message);
    if (q != null) return Uri.decodeComponent(q.group(1) ?? "");
    final p = _pathPattern.firstMatch(message);
    if (p != null) return Uri.decodeComponent(p.group(1) ?? "");
    return null;
  }

  /// 메시지가 투어스타 URL인지 여부.
  static bool hasTourstarUrl(String message) => extractPostId(message) != null;
}
