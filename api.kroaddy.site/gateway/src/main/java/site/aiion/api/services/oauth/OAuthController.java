package site.aiion.api.services.oauth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import site.aiion.api.services.oauth.token.TokenService;
import site.aiion.api.services.oauth.util.JwtTokenProvider;

import java.util.HashMap;
import java.util.Map;

/**
 * OAuth 공통 컨트롤러
 * 로그아웃 등 공통 기능 제공
 */
@RestController
@RequestMapping("/api/oauth")
@Tag(name = "OAuth", description = "OAuth 인증 공통 기능")
public class OAuthController {
    
    private final TokenService tokenService;
    private final JwtTokenProvider jwtTokenProvider;
    
    public OAuthController(
            TokenService tokenService,
            JwtTokenProvider jwtTokenProvider) {
        this.tokenService = tokenService;
        this.jwtTokenProvider = jwtTokenProvider;
    }
    
    /**
     * 로그아웃
     * Redis에서 Access Token과 Refresh Token 삭제
     * 
     * @param authorization Authorization 헤더 (Bearer {token})
     * @param provider OAuth 제공자 (kakao, naver, google) - 선택사항, 토큰에서 추출 가능
     * @return 로그아웃 결과
     */
    @PostMapping("/logout")
    @Operation(summary = "로그아웃", description = "Redis에서 Access Token과 Refresh Token을 삭제합니다.")
    public ResponseEntity<Map<String, Object>> logout(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(value = "provider", required = false) String provider) {
        
        System.out.println("[OAuthController] 로그아웃 요청 수신");
        
        try {
            // Authorization 헤더에서 토큰 추출
            if (authorization == null || !authorization.startsWith("Bearer ")) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(createErrorResponse("인증 토큰이 필요합니다."));
            }
            
            String token = authorization.substring(7); // "Bearer " 제거
            
            // 토큰 유효성 검증
            if (!jwtTokenProvider.validateToken(token)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(createErrorResponse("유효하지 않은 토큰입니다."));
            }
            
            // 토큰에서 사용자 ID와 provider 추출
            var claims = jwtTokenProvider.getAllClaimsFromToken(token);
            String userId = claims.getSubject();
            String tokenProvider = provider != null ? provider : claims.get("provider", String.class);
            
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(createErrorResponse("토큰에서 사용자 ID를 추출할 수 없습니다."));
            }
            
            if (tokenProvider == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(createErrorResponse("토큰에서 provider를 추출할 수 없습니다. provider 파라미터를 제공해주세요."));
            }
            
            System.out.println("[OAuthController] 로그아웃 처리 - userId: " + userId + ", provider: " + tokenProvider);
            
            // Redis에서 토큰 삭제
            tokenService.deleteTokens(tokenProvider, userId);
            
            System.out.println("[OAuthController] 토큰 삭제 완료 - userId: " + userId + ", provider: " + tokenProvider);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "로그아웃 성공");
            response.put("userId", userId);
            response.put("provider", tokenProvider);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            System.err.println("[OAuthController] 로그아웃 중 오류 발생: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("로그아웃 중 오류가 발생했습니다: " + e.getMessage()));
        }
    }
    
    /**
     * 에러 응답 생성
     */
    private Map<String, Object> createErrorResponse(String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("message", message);
        return response;
    }
}
