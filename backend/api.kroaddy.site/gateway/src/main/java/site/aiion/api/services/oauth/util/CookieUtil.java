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
 *
 * 크로스 사이트 환경 (web.kroaddy.site ↔ api.kroaddy.site):
 *   - 운영: Secure=true, SameSite=None, domain=.kroaddy.site
 *   - 로컬: Secure=false, SameSite=Lax, domain 미설정
 */
public final class CookieUtil {

    private static final String REFRESH_TOKEN_NAME = "refresh_token";
    private static final String ACCESS_TOKEN_NAME  = "access_token";

    private static final int MAX_AGE_30_DAYS = 30 * 24 * 60 * 60;
    private static final int MAX_AGE_15_MIN  = 15 * 60;

    /** 운영 환경 쿠키 도메인 (크로스 사이트 전송용) */
    private static final String PROD_DOMAIN = ".kroaddy.site";

    private CookieUtil() {}

    // ── Refresh Token ────────────────────────────────────────────────────────

    /**
     * refresh_token HttpOnly 쿠키를 응답 헤더에 추가합니다.
     */
    public static void setRefreshTokenCookie(HttpServletResponse response,
                                             String tokenValue,
                                             boolean isHttps) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie
                .from(REFRESH_TOKEN_NAME, tokenValue)
                .httpOnly(true)
                .secure(isHttps)
                .path("/")
                .maxAge(MAX_AGE_30_DAYS);

        applyDomainAndSameSite(builder, isHttps);
        response.addHeader("Set-Cookie", builder.build().toString());
    }

    /**
     * refresh_token 쿠키를 만료(삭제)합니다.
     * 운영 환경에서 ALB가 SSL을 종료하면 isHttps가 false로 들어올 수 있으므로
     * 프로덕션 속성(SameSite=None, Secure, domain)과 로컬 속성(Lax, 도메인 없음) 두 버전을
     * 모두 삭제하여 어떤 환경에서 설정된 쿠키도 확실히 제거합니다.
     */
    public static void expireRefreshTokenCookie(HttpServletResponse response,
                                                boolean isHttps) {
        // 프로덕션 버전 삭제 (SameSite=None, Secure, domain=.kroaddy.site)
        ResponseCookie.ResponseCookieBuilder prodBuilder = ResponseCookie
                .from(REFRESH_TOKEN_NAME, "")
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(0);
        applyDomainAndSameSite(prodBuilder, true);
        response.addHeader("Set-Cookie", prodBuilder.build().toString());

        // 로컬 버전 삭제 (SameSite=Lax, 도메인 없음)
        if (!isHttps) {
            ResponseCookie.ResponseCookieBuilder localBuilder = ResponseCookie
                    .from(REFRESH_TOKEN_NAME, "")
                    .httpOnly(true)
                    .secure(false)
                    .path("/")
                    .maxAge(0);
            applyDomainAndSameSite(localBuilder, false);
            response.addHeader("Set-Cookie", localBuilder.build().toString());
        }
    }

    // ── Access Token ─────────────────────────────────────────────────────────

    /**
     * access_token HttpOnly 쿠키를 응답 헤더에 추가합니다. TTL 15분.
     */
    public static void setAccessTokenCookie(HttpServletResponse response,
                                            String tokenValue,
                                            boolean isHttps) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie
                .from(ACCESS_TOKEN_NAME, tokenValue)
                .httpOnly(true)
                .secure(isHttps)
                .path("/")
                .maxAge(MAX_AGE_15_MIN);

        applyDomainAndSameSite(builder, isHttps);
        response.addHeader("Set-Cookie", builder.build().toString());
    }

    /**
     * access_token 쿠키를 만료(삭제)합니다.
     * 프로덕션/로컬 두 버전 모두 삭제합니다.
     */
    public static void expireAccessTokenCookie(HttpServletResponse response,
                                               boolean isHttps) {
        // 프로덕션 버전 삭제
        ResponseCookie.ResponseCookieBuilder prodBuilder = ResponseCookie
                .from(ACCESS_TOKEN_NAME, "")
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(0);
        applyDomainAndSameSite(prodBuilder, true);
        response.addHeader("Set-Cookie", prodBuilder.build().toString());

        // 로컬 버전 삭제
        if (!isHttps) {
            ResponseCookie.ResponseCookieBuilder localBuilder = ResponseCookie
                    .from(ACCESS_TOKEN_NAME, "")
                    .httpOnly(true)
                    .secure(false)
                    .path("/")
                    .maxAge(0);
            applyDomainAndSameSite(localBuilder, false);
            response.addHeader("Set-Cookie", localBuilder.build().toString());
        }
    }

    // ── 내부 헬퍼 ────────────────────────────────────────────────────────────

    /**
     * HTTPS(운영): SameSite=None + domain=.kroaddy.site (크로스 사이트 전송 허용)
     * HTTP(로컬):  SameSite=Lax  + domain 미설정 (호스트 전용)
     */
    private static void applyDomainAndSameSite(
            ResponseCookie.ResponseCookieBuilder builder, boolean isHttps) {
        if (isHttps) {
            builder.sameSite("None").domain(PROD_DOMAIN);
        } else {
            builder.sameSite("Lax");
        }
    }
}
