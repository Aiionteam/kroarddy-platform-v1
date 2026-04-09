package site.aiion.api.services.oauth.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import site.aiion.api.services.oauth.token.TokenService;
import site.aiion.api.services.oauth.util.JwtTokenProvider;
import site.aiion.api.services.user.UserService;
import site.aiion.api.services.user.UserModel;
import site.aiion.api.services.user.common.domain.Messenger;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import site.aiion.api.services.oauth.util.CookieUtil;
import site.aiion.api.services.oauth.util.TokenHashUtil;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth", description = "인증/토큰 관리 API")
public class AuthController {

    private final JwtTokenProvider jwtTokenProvider;
    private final TokenService tokenService;
    private final UserService userService;

    public AuthController(JwtTokenProvider jwtTokenProvider, TokenService tokenService, UserService userService) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.tokenService = tokenService;
        this.userService = userService;
    }

    /**
     * ALB/Nginx SSL 종료 환경에서도 HTTPS 여부를 올바르게 판단합니다.
     * request.isSecure()는 프록시 뒤에서 항상 false를 반환하므로
     * X-Forwarded-Proto 헤더를 우선 확인합니다.
     */
    private boolean isHttpsRequest(HttpServletRequest request) {
        String proto = request.getHeader("X-Forwarded-Proto");
        if (proto != null) {
            return "https".equalsIgnoreCase(proto);
        }
        return request.isSecure();
    }

    /**
     * Access Token 갱신
     * HttpOnly 쿠키의 Refresh Token을 사용하여 새로운 Access Token 발급
     */
    @PostMapping("/refresh")
    @Operation(summary = "Access Token 갱신", description = "HttpOnly 쿠키 또는 요청 body의 Refresh Token으로 새로운 Access Token을 발급합니다.")
    public ResponseEntity<Map<String, Object>> refreshAccessToken(
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request,
            HttpServletResponse response) {
        
        System.out.println("=== Access Token 갱신 요청 ===");
        
        try {
            // 1. HttpOnly 쿠키에서 Refresh Token 가져오기 (웹 브라우저)
            // 동일 이름의 쿠키가 여러 개 있을 수 있으므로 (host-only + domain 공존) 모두 수집
            java.util.List<String> refreshTokenCandidates = new java.util.ArrayList<>();
            String refreshToken = null;
            Cookie[] cookies = request.getCookies();

            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if ("refresh_token".equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isEmpty()) {
                        refreshTokenCandidates.add(cookie.getValue());
                    }
                }
            }

            if (refreshTokenCandidates.size() == 1) {
                refreshToken = refreshTokenCandidates.get(0);
            } else if (refreshTokenCandidates.size() > 1) {
                // 복수 쿠키: 유효한 JWT인 것만 후보로 유지, DB 해시 비교는 아래서 수행
                // 우선 마지막(가장 최근에 추가된) 것을 시도하고, 실패 시 나머지를 순서대로 시도
                System.out.println("경고: refresh_token 쿠키가 " + refreshTokenCandidates.size() + "개 감지됨 (stale 쿠키 공존). 순차 검증합니다.");
                refreshToken = refreshTokenCandidates.get(refreshTokenCandidates.size() - 1);
            }

            // 2. 쿠키에 없으면 요청 body에서 가져오기 (모바일 앱)
            if ((refreshToken == null || refreshToken.isEmpty()) && body != null) {
                Object bodyToken = body.get("refresh_token");
                if (bodyToken != null) {
                    refreshToken = bodyToken.toString().trim();
                    System.out.println("Refresh Token을 요청 body에서 가져옴 (모바일)");
                }
            }
            
            if (refreshToken == null || refreshToken.isEmpty()) {
                System.err.println("Refresh Token이 쿠키와 body 모두에 없습니다.");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("success", false);
                errorResponse.put("message", "Refresh Token이 없습니다. 다시 로그인해주세요.");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
            }
            
            System.out.println("Refresh Token을 쿠키에서 가져옴");
            
            // 2. Refresh Token 검증
            if (!jwtTokenProvider.validateToken(refreshToken)) {
                System.err.println("Refresh Token이 유효하지 않습니다.");
                
                // 쿠키 삭제 (ResponseCookie 사용 — HttpOnly 직렬화 보장)
                CookieUtil.expireRefreshTokenCookie(response, isHttpsRequest(request));
                
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("success", false);
                errorResponse.put("message", "Refresh Token이 만료되었습니다. 다시 로그인해주세요.");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
            }
            
            // 3. Refresh Token에서 사용자 정보 추출
            String userId = jwtTokenProvider.getUserIdFromToken(refreshToken);
            String provider = jwtTokenProvider.getProviderFromToken(refreshToken);
            
            if (userId == null || provider == null) {
                System.err.println("Refresh Token에서 사용자 정보를 추출할 수 없습니다.");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("success", false);
                errorResponse.put("message", "잘못된 Refresh Token입니다.");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
            }
            
            System.out.println("사용자 정보 추출: userId=" + userId + ", provider=" + provider);
            
            // 4. User 테이블에서 Refresh Token 조회 및 검증
            Messenger userMessenger = userService.findById(UserModel.builder().id(Long.parseLong(userId)).build());
            if (userMessenger.getCode() != 200 || userMessenger.getData() == null) {
                System.err.println("사용자를 찾을 수 없습니다.");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("success", false);
                errorResponse.put("message", "사용자를 찾을 수 없습니다.");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
            }
            
            UserModel user = (UserModel) userMessenger.getData();
            String storedHash = user.getRefreshToken();

            // DB에는 HMAC-SHA256 해시가 저장되어 있으므로 수신 토큰도 해시 후 비교
            // 복수 쿠키 공존 시: 후보 중 DB 해시와 일치하는 토큰을 탐색
            String currentHash = TokenHashUtil.hash(refreshToken);
            if (storedHash == null || !storedHash.equals(currentHash)) {
                // 마지막 후보가 실패 → 나머지 후보를 순서 역순으로 시도
                String matchedToken = null;
                if (refreshTokenCandidates.size() > 1) {
                    for (int i = refreshTokenCandidates.size() - 2; i >= 0; i--) {
                        String candidate = refreshTokenCandidates.get(i);
                        String candidateHash = TokenHashUtil.hash(candidate);
                        if (storedHash != null && storedHash.equals(candidateHash)
                                && jwtTokenProvider.validateToken(candidate)) {
                            matchedToken = candidate;
                            System.out.println("stale 쿠키 탐색: 후보 " + i + "번이 DB 해시와 일치함");
                            break;
                        }
                    }
                }

                // RTR Grace Period 확인: 직전에 교체된 구 토큰인지 Redis에서 검증 (30초 유예)
                if (matchedToken == null && tokenService.isInGracePeriod(provider, userId, currentHash)) {
                    System.out.println("RTR Grace Period 내 구 토큰 허용: userId=" + userId);
                    // Grace Period 토큰은 검증 통과 — 아래에서 새 RTR 진행
                    matchedToken = refreshToken;
                }

                if (matchedToken == null) {
                    System.err.println("User 테이블에 저장된 Refresh Token 해시와 일치하지 않습니다.");
                    Map<String, Object> errorResponse = new HashMap<>();
                    errorResponse.put("success", false);
                    errorResponse.put("message", "유효하지 않은 Refresh Token입니다.");
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
                }
                refreshToken = matchedToken;
            }

            System.out.println("User 테이블의 Refresh Token 해시 검증 완료");

            // 5. Refresh Token Rotation: 새 Refresh Token 발급 + DB 갱신
            // 구 토큰 해시를 Grace Period로 보관 (30초) → 동시 요청 Race Condition 흡수
            tokenService.saveGraceToken(provider, userId, TokenHashUtil.hash(refreshToken));
            String newRefreshToken = jwtTokenProvider.generateRefreshToken(userId, provider);
            userService.updateRefreshToken(Long.parseLong(userId), TokenHashUtil.hash(newRefreshToken));
            System.out.println("RTR: 새 Refresh Token 발급 및 해시 DB 갱신 완료");

            // 6. 새로운 Access Token 생성
            Map<String, Object> userInfo = new HashMap<>();
            userInfo.put("app_user_id", userId);
            String newAccessToken = jwtTokenProvider.generateAccessToken(userId, provider, userInfo);

            System.out.println("새 Access Token 생성 완료 (TTL 15분)");

            // 7. 쿠키 갱신 (Access + Refresh)
            boolean isHttps = isHttpsRequest(request);
            CookieUtil.setAccessTokenCookie(response, newAccessToken, isHttps);
            CookieUtil.setRefreshTokenCookie(response, newRefreshToken, isHttps);

            // 8. 응답 반환 (점진적 전환: body에도 포함하되 프론트가 쿠키 우선 사용)
            Map<String, Object> successResponse = new HashMap<>();
            successResponse.put("success", true);
            successResponse.put("access_token", newAccessToken);
            // 모바일 앱은 HttpOnly 쿠키를 쓰지 않으므로 RTR 이후 새 Refresh Token을 body로 내려 저장해야 함
            successResponse.put("refresh_token", newRefreshToken);
            successResponse.put("token_type", "Bearer");
            successResponse.put("expires_in", 900);

            return ResponseEntity.ok(successResponse);
            
        } catch (Exception e) {
            System.err.println("Access Token 갱신 중 오류 발생: " + e.getMessage());
            e.printStackTrace();
            
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "토큰 갱신에 실패했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }
    
    /**
     * 로그아웃
     * HttpOnly 쿠키의 Refresh Token 삭제 및 Redis에서 토큰 제거
     */
    @PostMapping("/logout")
    @Operation(summary = "로그아웃", description = "Refresh Token 쿠키를 삭제하고 서버에서 토큰을 제거합니다.")
    public ResponseEntity<Map<String, Object>> logout(
            HttpServletRequest request,
            HttpServletResponse response) {
        
        System.out.println("=== 로그아웃 요청 ===");
        
        try {
            // 1. HttpOnly 쿠키에서 Refresh Token 가져오기
            String refreshToken = null;
            Cookie[] cookies = request.getCookies();
            
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if ("refresh_token".equals(cookie.getName())) {
                        refreshToken = cookie.getValue();
                        break;
                    }
                }
            }
            
            // 2. Refresh Token이 있으면 User 테이블과 Redis에서 삭제
            if (refreshToken != null && !refreshToken.isEmpty()) {
                try {
                    String userId = jwtTokenProvider.getUserIdFromToken(refreshToken);
                    String provider = jwtTokenProvider.getProviderFromToken(refreshToken);
                    
                    if (userId != null && provider != null) {
                        // User 테이블의 Refresh Token 삭제
                        Messenger updateResult = userService.updateRefreshToken(Long.parseLong(userId), null);
                        if (updateResult.getCode() == 200) {
                            System.out.println("User 테이블의 Refresh Token 삭제 완료: userId=" + userId);
                        } else {
                            System.err.println("User 테이블의 Refresh Token 삭제 실패: " + updateResult.getMessage());
                        }
                        
                        // Redis의 Access Token 삭제
                        tokenService.deleteTokens(provider, userId);
                        System.out.println("Redis에서 Access Token 삭제 완료: userId=" + userId + ", provider=" + provider);
                    } else {
                        System.err.println("Refresh Token에서 userId 또는 provider를 추출할 수 없습니다.");
                    }
                } catch (Exception e) {
                    System.err.println("토큰 삭제 중 오류 발생: " + e.getMessage());
                    e.printStackTrace();
                }
            } else {
                System.out.println("쿠키에 Refresh Token이 없습니다. (이미 로그아웃되었거나 쿠키가 만료됨)");
            }
            
            // 3. HttpOnly 쿠키 삭제 (Access + Refresh 모두 만료)
            boolean isHttps = isHttpsRequest(request);
            CookieUtil.expireAccessTokenCookie(response, isHttps);
            CookieUtil.expireRefreshTokenCookie(response, isHttps);

            System.out.println("Access/Refresh Token 쿠키 삭제 완료");
            
            // 4. 응답 반환
            Map<String, Object> successResponse = new HashMap<>();
            successResponse.put("success", true);
            successResponse.put("message", "로그아웃 성공");
            
            return ResponseEntity.ok(successResponse);
            
        } catch (Exception e) {
            System.err.println("로그아웃 중 오류 발생: " + e.getMessage());
            e.printStackTrace();
            
            // 오류가 발생해도 쿠키는 삭제
            CookieUtil.expireAccessTokenCookie(response, isHttpsRequest(request));
            CookieUtil.expireRefreshTokenCookie(response, isHttpsRequest(request));
            
            Map<String, Object> successResponse = new HashMap<>();
            successResponse.put("success", true);
            successResponse.put("message", "로그아웃 완료 (일부 오류 발생)");
            return ResponseEntity.ok(successResponse);
        }
    }
}

