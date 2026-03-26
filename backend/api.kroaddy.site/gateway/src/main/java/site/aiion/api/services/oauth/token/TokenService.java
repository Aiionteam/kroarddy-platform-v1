package site.aiion.api.services.oauth.token;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class TokenService {

    private static final String REDIS_WARN = "[TokenService] Redis 연결 실패(무시하고 진행): ";

    private final RedisTemplate<String, Object> redisTemplate;

    public TokenService(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * Redis 연결 가능 여부 확인
     * JwtAuthenticationFilter에서 hard check 여부 결정에 사용
     * — 연결 가능: 토큰 없으면 401 (강제 로그아웃 적용)
     * — 연결 불가: JWT 서명 검증만으로 진행 (degraded mode)
     */
    public boolean isRedisAvailable() {
        try {
            redisTemplate.opsForValue().get("__ping__");
            return true;
        } catch (Exception e) {
            System.err.println("[TokenService] Redis 불가 (degraded mode): " + e.getMessage());
            return false;
        }
    }

    /**
     * Access Token 저장 (Redis 연결 실패 시 로그만 남기고 진행 - 로그인은 성공 처리)
     */
    public void saveAccessToken(String provider, String userId, String accessToken, long expireTime) {
        try {
            String key = String.format("token:%s:%s:access", provider, userId);
            redisTemplate.opsForValue().set(key, accessToken, expireTime, TimeUnit.SECONDS);
            System.out.println("Redis 저장 - Key: " + key + ", TTL: " + expireTime + "초");
        } catch (Exception e) {
            System.err.println(REDIS_WARN + e.getMessage());
        }
    }

    /**
     * Refresh Token 저장 (Redis 연결 실패 시 무시)
     * @deprecated Refresh Token은 이제 User 테이블에 저장됩니다.
     */
    @Deprecated
    public void saveRefreshToken(String provider, String userId, String refreshToken, long expireTime) {
        try {
            String key = String.format("token:%s:%s:refresh", provider, userId);
            redisTemplate.opsForValue().set(key, refreshToken, expireTime, TimeUnit.SECONDS);
            System.out.println("Redis 저장 - Key: " + key + ", TTL: " + expireTime + "초");
        } catch (Exception e) {
            System.err.println(REDIS_WARN + e.getMessage());
        }
    }

    /**
     * Access Token 조회 (Redis 실패 시 null 반환)
     */
    public String getAccessToken(String provider, String userId) {
        try {
            String key = String.format("token:%s:%s:access", provider, userId);
            Object token = redisTemplate.opsForValue().get(key);
            return token != null ? token.toString() : null;
        } catch (Exception e) {
            System.err.println(REDIS_WARN + e.getMessage());
            return null;
        }
    }

    /**
     * Refresh Token 조회 (Redis 실패 시 null)
     * @deprecated Refresh Token은 User 테이블에서 조회하세요.
     */
    @Deprecated
    public String getRefreshToken(String provider, String userId) {
        try {
            String key = String.format("token:%s:%s:refresh", provider, userId);
            Object token = redisTemplate.opsForValue().get(key);
            return token != null ? token.toString() : null;
        } catch (Exception e) {
            System.err.println(REDIS_WARN + e.getMessage());
            return null;
        }
    }

    /**
     * 키 존재 여부 확인 (Redis 실패 시 false 반환)
     */
    public boolean hasKey(String key) {
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(key));
        } catch (Exception e) {
            System.err.println(REDIS_WARN + e.getMessage());
            return false;
        }
    }

    /**
     * 로그아웃 시 REVOKED 마커 설정 (JWT 만료 시각까지 유지)
     * JWT 필터에서 이 마커가 있으면 해당 userId의 요청을 차단
     */
    public void revokeTokens(String provider, String userId, long expireSeconds) {
        try {
            String revokedKey = String.format("REVOKED:%s:%s", provider, userId);
            redisTemplate.opsForValue().set(revokedKey, "1", expireSeconds, java.util.concurrent.TimeUnit.SECONDS);
            System.out.println("[TokenService] REVOKED 마커 설정: " + revokedKey);
        } catch (Exception e) {
            System.err.println(REDIS_WARN + e.getMessage());
        }
    }

    /**
     * REVOKED 마커 조회 — 로그아웃/강제 폐기 여부 확인.
     * JwtAuthenticationFilter에서 호출합니다.
     * Redis 장애 시 false 반환 (degraded mode: 서명 검증만으로 진행).
     */
    public boolean isRevoked(String provider, String userId) {
        try {
            String key = String.format("REVOKED:%s:%s", provider, userId);
            return Boolean.TRUE.equals(redisTemplate.hasKey(key));
        } catch (Exception e) {
            System.err.println(REDIS_WARN + e.getMessage());
            return false;
        }
    }

    /**
     * 로그아웃 처리: REVOKED 마커 설정 (Redis는 블랙리스트 전용으로 사용).
     * 기존 access/refresh 키는 더 이상 Redis에 저장하지 않으므로 삭제 불필요.
     */
    public void deleteTokens(String provider, String userId) {
        try {
            System.out.println("[TokenService] 로그아웃 REVOKED 마커 설정 - provider: " + provider + ", userId: " + userId);
            // REVOKED 마커: Access Token TTL(15분)과 동일하게 유지하면 충분
            revokeTokens(provider, userId, 900);
            System.out.println("[TokenService] REVOKED 마커 설정 완료");
        } catch (Exception e) {
            System.err.println(REDIS_WARN + e.getMessage());
        }
    }

    /**
     * Authorization Code 저장 (Redis 실패 시 무시)
     */
    public void saveAuthorizationCode(String provider, String code, String state, long expireTime) {
        try {
            String key = String.format("code:%s:%s", provider, code);
            redisTemplate.opsForValue().set(key, state != null ? state : "", expireTime, TimeUnit.SECONDS);
        } catch (Exception e) {
            System.err.println(REDIS_WARN + e.getMessage());
        }
    }

    /**
     * Authorization Code 검증 및 삭제 (Redis 실패 시 null)
     */
    public String verifyAndDeleteAuthorizationCode(String provider, String code) {
        try {
            String key = String.format("code:%s:%s", provider, code);
            Object state = redisTemplate.opsForValue().get(key);
            if (state != null) {
                redisTemplate.delete(key);
                return state.toString();
            }
        } catch (Exception e) {
            System.err.println(REDIS_WARN + e.getMessage());
        }
        return null;
    }
}

