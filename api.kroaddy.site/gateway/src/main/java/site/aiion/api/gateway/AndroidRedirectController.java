package site.aiion.api.gateway;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Android 앱 OAuth 콜백 중간 페이지
 *
 * Chrome Custom Tab은 서버사이드 302 리다이렉트로 custom scheme(tourstory://)을
 * 앱에 전달하지 못하는 경우가 있음.
 * 이 엔드포인트는 HTML + JavaScript를 이용해 클라이언트 측에서 앱을 열도록 함.
 *
 * 게이트웨이 redirect URL:
 *   http://[SERVER]/login/callback?token=JWT&provider=google
 *   → 이 페이지가 → window.location.href = 'tourstory://callback/login/callback?token=JWT'
 *   → Android OS가 intent-filter 매칭 → 앱 실행
 */
@RestController
public class AndroidRedirectController {

    @GetMapping(value = "/login/callback", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> androidOAuthCallback(
            @RequestParam(required = false) String token,
            @RequestParam(required = false) String provider,
            @RequestParam(required = false) String error,
            @RequestParam(required = false) String error_description) {

        // 앱으로 전달할 딥링크 URL
        String appDeepLink;

        if (token != null && !token.isEmpty()) {
            appDeepLink = "tourstory://callback/login/callback?token=" + token
                    + (provider != null ? "&provider=" + provider : "");
        } else if (error != null) {
            appDeepLink = "tourstory://callback/login/callback?error=" + error
                    + (error_description != null ? "&error_description=" + error_description : "");
        } else {
            appDeepLink = "tourstory://callback/login/callback?error=unknown";
        }

        String html = "<!DOCTYPE html>"
                + "<html lang='ko'>"
                + "<head>"
                + "  <meta charset='UTF-8'>"
                + "  <meta name='viewport' content='width=device-width, initial-scale=1.0'>"
                + "  <title>TourStory 로그인</title>"
                + "  <style>"
                + "    body { font-family: -apple-system, sans-serif; display: flex; align-items: center;"
                + "           justify-content: center; min-height: 100vh; margin: 0;"
                + "           background: linear-gradient(135deg, #F5F3FF, #EEF2FF); }"
                + "    .card { background: white; border-radius: 16px; padding: 32px; text-align: center;"
                + "            box-shadow: 0 4px 24px rgba(0,0,0,0.1); max-width: 320px; width: 90%; }"
                + "    .emoji { font-size: 48px; margin-bottom: 12px; }"
                + "    h2 { color: #7C3AED; margin: 0 0 8px; }"
                + "    p  { color: #6B7280; font-size: 14px; }"
                + "    a  { display: inline-block; margin-top: 16px; padding: 12px 24px;"
                + "         background: #7C3AED; color: white; border-radius: 10px;"
                + "         text-decoration: none; font-weight: 600; }"
                + "  </style>"
                + "</head>"
                + "<body>"
                + "  <div class='card'>"
                + "    <div class='emoji'>🗺️</div>"
                + "    <h2>TourStory</h2>"
                + "    <p>앱으로 돌아가는 중...</p>"
                + "    <a href='" + appDeepLink + "'>앱 열기</a>"
                + "  </div>"
                + "  <script>"
                + "    // 즉시 앱 딥링크로 리다이렉트 시도"
                + "    (function() {"
                + "      var deepLink = '" + appDeepLink + "';"
                + "      window.location.replace(deepLink);"
                + "      // 500ms 후에도 앱이 안 열리면 버튼을 안내"
                + "      setTimeout(function() {"
                + "        document.querySelector('p').textContent = '아래 버튼을 눌러 앱을 여세요';"
                + "      }, 500);"
                + "    })();"
                + "  </script>"
                + "</body>"
                + "</html>";

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(html);
    }
}
