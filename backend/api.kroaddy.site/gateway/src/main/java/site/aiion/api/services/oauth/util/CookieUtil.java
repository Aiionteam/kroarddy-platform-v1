package site.aiion.api.services.oauth.util;

import org.springframework.http.ResponseCookie;
import jakarta.servlet.http.HttpServletResponse;

/**
 * HttpOnly 쿠키를 안전하게 생성/삭제하는 유틸리티.
 *
 * jakarta.servlet.http.Cookie + setAttribute("SameSite", ...) 조합을 사용하면
 * Spring Boot 내부 CookieSerializer가 Set-Cookie 헤더를 재직렬화하는 과정에서
 * HttpOnly 플래그가 누락되는 버그가 발생합니다.
 * ResponseCookie 빌더는 Set-Cookie 헤더를 직접 문자열로 생성하므로 이 문제가 없습니다.
 */
public final class CookieUtil {

    private static final String REFRESH_TOKEN_NAME = "refresh_token";
    private static final int MAX_AGE_30_DAYS = 30 * 24 * 60 * 60;

    private CookieUtil() {}

    /**
     * refresh_token HttpOnly 쿠키를 응답 헤더에 추가합니다.
     *
     * @param response    HttpServletResponse
     * @param tokenValue  쿠키에 저장할 Refresh Token 값
     * @param isHttps     true이면 Secure 속성 포함 (HTTPS 환경)
     */
    public static void setRefreshTokenCookie(HttpServletResponse response,
                                             String tokenValue,
                                             boolean isHttps) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_TOKEN_NAME, tokenValue)
                .httpOnly(true)          // JavaScript 접근 차단 (XSS 방어)
                .secure(isHttps)         // HTTPS 전용
                .path("/")
                .maxAge(MAX_AGE_30_DAYS)
                .sameSite("Lax")         // CSRF 방어
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    /**
     * refresh_token 쿠키를 만료(삭제)하는 헤더를 추가합니다.
     *
     * @param response HttpServletResponse
     * @param isHttps  true이면 Secure 속성 포함 (설정 시와 동일해야 삭제됨)
     */
    public static void expireRefreshTokenCookie(HttpServletResponse response,
                                                boolean isHttps) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_TOKEN_NAME, "")
                .httpOnly(true)
                .secure(isHttps)
                .path("/")
                .maxAge(0)               // 즉시 만료
                .sameSite("Lax")
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }
}
