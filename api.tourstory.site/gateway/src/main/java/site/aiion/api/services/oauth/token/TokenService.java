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
     * 토큰 삭제 (Redis 실패 시 무시)
     */
    public void deleteTokens(String provider, String userId) {
        try {
            String accessKey = String.format("token:%s:%s:access", provider, userId);
            String refreshKey = String.format("token:%s:%s:refresh", provider, userId);
            System.out.println("[TokenService] 토큰 삭제 - provider: " + provider + ", userId: " + userId);
            redisTemplate.delete(accessKey);
            redisTemplate.delete(refreshKey);
            System.out.println("[TokenService] 토큰 삭제 완료");
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

