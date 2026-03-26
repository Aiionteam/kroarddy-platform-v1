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
     * HTTPS(운영) 환경에서는 이전 코드가 남긴 host-only(SameSite=Lax) 쿠키도 동시에 삭제하여
     * 브라우저에 동명의 쿠키가 두 개 공존하는 문제를 방지합니다.
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

        // 운영 환경: 이전 코드가 남긴 host-only 쿠키(domain 없음, SameSite=Lax)를 즉시 삭제
        if (isHttps) {
            response.addHeader("Set-Cookie", ResponseCookie
                    .from(REFRESH_TOKEN_NAME, "")
                    .httpOnly(true).secure(false).path("/").maxAge(0).sameSite("Lax")
                    .build().toString());
        }
    }

    /**
     * refresh_token 쿠키를 만료(삭제)합니다.
     * 프로덕션 속성(SameSite=None, Secure, domain=.kroaddy.site)과
     * host-only 속성(SameSite=Lax, domain 없음) 두 버전을 항상 모두 삭제합니다.
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

        // host-only 버전 삭제 (이전 코드의 SameSite=Lax, domain 없음) — 운영/로컬 모두 항상 실행
        response.addHeader("Set-Cookie", ResponseCookie
                .from(REFRESH_TOKEN_NAME, "")
                .httpOnly(true).secure(false).path("/").maxAge(0).sameSite("Lax")
                .build().toString());
    }

    // ── Access Token ─────────────────────────────────────────────────────────

    /**
     * access_token HttpOnly 쿠키를 응답 헤더에 추가합니다. TTL 15분.
     * HTTPS(운영) 환경에서는 이전 코드가 남긴 host-only 쿠키도 동시에 삭제합니다.
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

        // 운영 환경: 이전 코드가 남긴 host-only 쿠키를 즉시 삭제
        if (isHttps) {
            response.addHeader("Set-Cookie", ResponseCookie
                    .from(ACCESS_TOKEN_NAME, "")
                    .httpOnly(true).secure(false).path("/").maxAge(0).sameSite("Lax")
                    .build().toString());
        }
    }

    /**
     * access_token 쿠키를 만료(삭제)합니다.
     * 프로덕션/host-only 두 버전을 항상 모두 삭제합니다.
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

        // host-only 버전 삭제 — 항상 실행
        response.addHeader("Set-Cookie", ResponseCookie
                .from(ACCESS_TOKEN_NAME, "")
                .httpOnly(true).secure(false).path("/").maxAge(0).sameSite("Lax")
                .build().toString());
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
