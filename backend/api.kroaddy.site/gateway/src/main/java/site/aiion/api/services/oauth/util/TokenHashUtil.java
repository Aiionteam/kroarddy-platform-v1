package site.aiion.api.services.oauth.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Refresh Token DB 저장 전 SHA-256 해싱 유틸리티.
 *
 * DB에 JWT 원문을 그대로 저장하면 DB 유출 시 모든 세션이 탈취됩니다.
 * SHA-256 해시값만 저장하면 해시로는 원래 토큰을 역산할 수 없으므로
 * DB가 유출되어도 refresh token 자체는 보호됩니다.
 *
 * 사용 패턴:
 *   저장: userService.updateRefreshToken(userId, TokenHashUtil.hash(jwtRefreshToken))
 *   검증: storedHash.equals(TokenHashUtil.hash(incomingToken))
 *   삭제: userService.updateRefreshToken(userId, null)
 */
public final class TokenHashUtil {

    private TokenHashUtil() {}

    /**
     * 주어진 토큰 문자열을 SHA-256으로 해시하여 소문자 hex 문자열로 반환합니다.
     * 토큰이 null이면 null을 반환합니다.
     */
    public static String hash(String token) {
        if (token == null) return null;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hashBytes.length * 2);
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256은 JVM 표준 알고리즘이므로 이 예외는 실질적으로 발생하지 않음
            throw new IllegalStateException("SHA-256 알고리즘을 찾을 수 없습니다.", e);
        }
    }
}
