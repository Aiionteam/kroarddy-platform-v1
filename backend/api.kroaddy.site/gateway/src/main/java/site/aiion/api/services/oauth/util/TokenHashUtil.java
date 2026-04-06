package site.aiion.api.services.oauth.util;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

/**
 * Refresh Token DB 저장 전 HMAC-SHA256 해싱 유틸리티.
 *
 * 기존 SHA-256 단순 해싱 대비 서버 Secret이 없으면 검증 자체가 불가능하므로
 * DB 유출 + 알고리즘 노출이 동시에 일어나도 토큰을 역산할 수 없습니다.
 *
 * 환경 변수 JWT_SECRET (32바이트 이상 권장)을 반드시 설정하세요.
 * 설정되지 않은 경우 기동 시 IllegalStateException을 발생시킵니다.
 */
public final class TokenHashUtil {

    private static final String ALGORITHM = "HmacSHA256";

    /** 환경 변수 키 이름 */
    private static final String SECRET_ENV = "JWT_SECRET";

    private TokenHashUtil() {}

    /**
     * 서버 Secret으로 주어진 토큰을 HMAC-SHA256 해시 후 소문자 hex 문자열로 반환합니다.
     * 토큰이 null이면 null을 반환합니다.
     */
    public static String hash(String token) {
        if (token == null) return null;
        String secret = getSecret();
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            SecretKeySpec keySpec = new SecretKeySpec(
                    secret.getBytes(StandardCharsets.UTF_8), ALGORITHM);
            mac.init(keySpec);
            byte[] hashBytes = mac.doFinal(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hashBytes.length * 2);
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("HMAC-SHA256 해싱 실패", e);
        }
    }

    private static String getSecret() {
        String secret = System.getenv(SECRET_ENV);
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "[TokenHashUtil] 환경 변수 " + SECRET_ENV + "가 설정되지 않았습니다. " +
                    "32바이트 이상의 랜덤 문자열을 설정하세요.");
        }
        return secret;
    }
}
