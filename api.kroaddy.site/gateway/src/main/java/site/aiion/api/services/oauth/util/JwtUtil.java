package site.aiion.api.services.oauth.util;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

/**
 * JWT 토큰을 파싱하고 확인하는 유틸리티 클래스
 * 시그니처 검증 없이 토큰 내용만 확인 (디버깅용)
 */
public class JwtUtil {
    
    /**
     * JWT 토큰을 디코딩하여 내용 확인 (시그니처 검증 없음)
     * @param token JWT 토큰 (Bearer 접두사 포함 가능)
     * @return 토큰 정보를 담은 Map
     */
    public static Map<String, Object> parseTokenWithoutValidation(String token) {
        try {
            // Bearer 접두사 제거
            if (token != null && token.startsWith("Bearer ")) {
                token = token.substring(7);
            }
            
            if (token == null || token.isEmpty()) {
                return Map.of("error", "토큰이 없습니다");
            }
            
            // JWT 토큰은 3부분으로 구성: header.payload.signature
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                return Map.of("error", "유효하지 않은 JWT 토큰 형식입니다");
            }
            
            // Base64로 디코딩
            String header = decodeBase64(parts[0]);
            String payload = decodeBase64(parts[1]);
            String signature = parts[2];
            
            return Map.of(
                "header", header,
                "payload", payload,
                "signature", signature.substring(0, Math.min(signature.length(), 20)) + "...",
                "raw_token", token,
                "is_valid_format", true
            );
        } catch (Exception e) {
            return Map.of(
                "error", "토큰 파싱 실패: " + e.getMessage(),
                "is_valid_format", false
            );
        }
    }
    
    /**
     * Base64 URL-safe 디코딩
     */
    private static String decodeBase64(String base64String) {
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(base64String);
            return new String(decoded, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "디코딩 실패: " + e.getMessage();
        }
    }
    
    /**
     * JWT 토큰의 만료 시간 확인
     * @param token JWT 토큰
     * @return 만료 정보를 담은 Map
     */
    public static Map<String, Object> checkTokenExpiration(String token) {
        try {
            if (token != null && token.startsWith("Bearer ")) {
                token = token.substring(7);
            }
            
            if (token == null || token.isEmpty()) {
                return Map.of("error", "토큰이 없습니다");
            }
            
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                return Map.of("error", "유효하지 않은 JWT 토큰 형식입니다");
            }
            
            String payload = decodeBase64(parts[1]);
            // payload는 JSON 형식이므로 간단히 확인만 함
            // 실제로는 JSON 파싱 라이브러리를 사용하는 것이 좋습니다
            
            boolean isExpired = false;
            String expMessage = "토큰 내용을 확인할 수 없습니다";
            
            if (payload.contains("\"exp\"")) {
                // exp 필드가 있으면 만료 시간이 설정되어 있음
                expMessage = "만료 시간이 설정되어 있습니다 (실제 검증은 시그니처 검증 필요)";
            }
            
            return Map.of(
                "payload_preview", payload.length() > 200 ? payload.substring(0, 200) + "..." : payload,
                "expiration_info", expMessage,
                "is_expired", isExpired
            );
        } catch (Exception e) {
            return Map.of("error", "만료 시간 확인 실패: " + e.getMessage());
        }
    }
    
    /**
     * 토큰 정보를 포맷팅하여 출력용 문자열 생성
     */
    public static String formatTokenInfo(String token) {
        Map<String, Object> tokenInfo = parseTokenWithoutValidation(token);
        StringBuilder sb = new StringBuilder();
        sb.append("\n=== JWT 토큰 정보 ===\n");
        tokenInfo.forEach((key, value) -> {
            sb.append(key).append(": ").append(value).append("\n");
        });
        sb.append("====================\n");
        return sb.toString();
    }
}

