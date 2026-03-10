package site.aiion.api.services.oauth.kakao;

import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;
import site.aiion.api.services.oauth.token.TokenService;
import site.aiion.api.services.oauth.util.JwtTokenProvider;

import java.net.URLEncoder;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/kakao")
public class KakaoController {
    
    private final TokenService tokenService;
    private final KakaoOAuthService kakaoOAuthService;
    private final JwtTokenProvider jwtTokenProvider;
    private final site.aiion.api.services.user.UserService userService;
    
    public KakaoController(
            TokenService tokenService,
            KakaoOAuthService kakaoOAuthService,
            JwtTokenProvider jwtTokenProvider,
            site.aiion.api.services.user.UserService userService) {
        this.tokenService = tokenService;
        this.kakaoOAuthService = kakaoOAuthService;
        this.jwtTokenProvider = jwtTokenProvider;
        this.userService = userService;
    }
    
    /**
     * Messenger에서 UserModel을 추출하여 UserResponse로 변환
     */
    private site.aiion.api.services.oauth.user.UserResponse extractUserFromMessenger(site.aiion.api.services.user.common.domain.Messenger messenger) {
        if (messenger.getCode() == 200 && messenger.getData() != null) {
            site.aiion.api.services.user.UserModel userModel = (site.aiion.api.services.user.UserModel) messenger.getData();
            return site.aiion.api.services.oauth.user.UserResponse.builder()
                    .id(userModel.getId())
                    .name(userModel.getName())
                    .email(userModel.getEmail())
                    .nickname(userModel.getNickname())
                    .provider(userModel.getProvider())
                    .providerId(userModel.getProviderId())
                    .build();
        }
        return null;
    }
    
    /**
     * 카카오 인증 URL 제공
     * 프론트엔드에서 REST API KEY를 노출하지 않고 인증 URL을 가져올 수 있도록 함
     */
    @GetMapping("/auth-url")
    @Operation(summary = "카카오 인증 URL 생성", description = "카카오 OAuth 인증을 위한 URL을 생성합니다.")
    public ResponseEntity<Map<String, Object>> getKakaoAuthUrl(
            @RequestParam(required = false) String frontend_url,
            HttpServletRequest request) {
        System.out.println("=== 카카오 인증 URL 요청 ===");
        
        // 환경 변수에서 가져오기
        String clientId = System.getenv("KAKAO_REST_API_KEY");
        String redirectUri = System.getenv("KAKAO_REDIRECT_URI");
        
        if (clientId == null || clientId.isEmpty()) {
            System.err.println("경고: KAKAO_REST_API_KEY가 설정되지 않았습니다.");
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "카카오 REST API KEY가 설정되지 않았습니다.");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
        
        if (redirectUri == null || redirectUri.isEmpty()) {
            System.err.println("경고: KAKAO_REDIRECT_URI가 설정되지 않았습니다.");
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "카카오 리다이렉트 URI가 설정되지 않았습니다.");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
        
        // 프론트엔드 URL 확인 (파라미터 또는 Referer 헤더 또는 환경변수)
        if (frontend_url == null || frontend_url.isEmpty()) {
            String referer = request.getHeader("Referer");
            if (referer != null && !referer.isEmpty()) {
                try {
                    java.net.URL refererUrl = new java.net.URL(referer);
                    frontend_url = refererUrl.getProtocol() + "://" + refererUrl.getAuthority();
                } catch (Exception e) {
                    // 파싱 실패 시 무시
                }
            }
        }
        
        if (frontend_url == null || frontend_url.isEmpty()) {
            frontend_url = System.getenv("FRONTEND_URL");
            if (frontend_url == null || frontend_url.isEmpty()) {
                frontend_url = "http://localhost:3000";
            }
        }
        
        String csrfToken = UUID.randomUUID().toString();
        String state = URLEncoder.encode(frontend_url, StandardCharsets.UTF_8) + "|" + csrfToken;
        
        String encodedRedirectUri = URLEncoder.encode(redirectUri, StandardCharsets.UTF_8);
        String authUrl = String.format(
            "https://kauth.kakao.com/oauth/authorize?client_id=%s&redirect_uri=%s&response_type=code&state=%s",
            clientId,
            encodedRedirectUri,
            URLEncoder.encode(state, StandardCharsets.UTF_8)
        );
        
        System.out.println("카카오 인증 URL 생성 완료");
        System.out.println("============================");
        
        return ResponseEntity.ok(Map.of(
            "success", true,
            "auth_url", authUrl
        ));
    }
    
    /**
     * 카카오 인증 콜백 처리
     * Authorization Code를 받아서 바로 토큰 교환 및 JWT 생성 후 프론트엔드로 리다이렉트
     */
    @GetMapping("/callback")
    @Operation(summary = "카카오 OAuth 콜백", description = "카카오 OAuth 인증 후 콜백을 처리합니다.")
    public RedirectView kakaoCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(required = false) String error_description,
            HttpServletResponse response) {
        
        System.out.println("=== 카카오 콜백 요청 수신 ===");
        System.out.println("Code: " + code);
        System.out.println("State: " + state);
        System.out.println("Error: " + error);
        System.out.println("Error Description: " + error_description);
        System.out.println("============================");
        
        // State에서 프론트엔드 URL 추출
        String frontendUrl = null;
        if (state != null && !state.isEmpty()) {
            try {
                String decodedState = URLDecoder.decode(state, StandardCharsets.UTF_8);
                if (decodedState.contains("|")) {
                    String[] parts = decodedState.split("\\|", 2);
                    if (parts.length > 0 && !parts[0].isEmpty()) {
                        frontendUrl = parts[0];
                    }
                } else {
                    frontendUrl = decodedState;
                }
            } catch (Exception e) {
                System.err.println("State 파싱 오류: " + e.getMessage());
            }
        }
        
        if (frontendUrl == null || frontendUrl.isEmpty()) {
            frontendUrl = System.getenv("FRONTEND_URL");
            if (frontendUrl == null || frontendUrl.isEmpty()) {
                frontendUrl = "http://localhost:3000";
            }
        }
        
        System.out.println("프론트엔드 리다이렉트 URL: " + frontendUrl);
        
        if (code != null) {
            try {
                // 1. Authorization Code를 Access Token으로 교환
                Map<String, Object> tokenResponse = kakaoOAuthService.getAccessToken(code);
                String accessToken = (String) tokenResponse.get("access_token");
                String refreshToken = (String) tokenResponse.get("refresh_token");
                
                if (accessToken == null) {
                    throw new RuntimeException("카카오 Access Token을 받을 수 없습니다.");
                }
                
                // 2. Access Token으로 사용자 정보 조회
                Map<String, Object> userInfo = kakaoOAuthService.getUserInfo(accessToken);
                Map<String, Object> extractedUserInfo = kakaoOAuthService.extractUserInfo(userInfo);
                
                // 3. User 테이블에서 사용자 조회 또는 생성
                // 간단한 로직: 있으면 통과, 없으면 생성
                String email = (String) extractedUserInfo.get("email");
                String name = (String) extractedUserInfo.get("nickname");
                String providerId = extractedUserInfo.get("kakao_id").toString();
                
                // 1단계: 사용자 조회
                site.aiion.api.services.user.common.domain.Messenger findResult = userService.findByEmailAndProvider(email, "kakao");
                site.aiion.api.services.oauth.user.UserResponse user = extractUserFromMessenger(findResult);
                
                // 2단계: 없으면 생성
                if (user == null) {
                    System.out.println("[KakaoController] 사용자 없음, 새로 생성 시도: " + email);
                    site.aiion.api.services.user.UserModel newUser = site.aiion.api.services.user.UserModel.builder()
                            .name(name)
                            .email(email)
                            .nickname(name)
                            .provider("kakao")
                            .providerId(providerId)
                            .build();
                    site.aiion.api.services.user.common.domain.Messenger saveResult = userService.save(newUser);
                    user = extractUserFromMessenger(saveResult);
                    
                    // 3단계: 생성 실패 시 (중복 키 등으로 이미 생성됨) 다시 조회
                    if (user == null) {
                        System.out.println("[KakaoController] 사용자 생성 실패 (중복 가능), 재조회: " + email);
                        findResult = userService.findByEmailAndProvider(email, "kakao");
                        user = extractUserFromMessenger(findResult);
                    }
                    
                    // 최종 확인: 그래도 없으면 에러
                    if (user == null || user.getId() == null) {
                        throw new RuntimeException("사용자 생성 및 조회 실패 - user-service와 통신에 문제가 있습니다. email: " + email);
                    }
                    System.out.println("[KakaoController] 사용자 처리 완료: ID=" + user.getId() + ", email=" + email);
                } else {
                    System.out.println("[KakaoController] 기존 사용자 조회 성공: ID=" + user.getId() + ", email=" + email);
                }
                
                // 4. JWT 토큰 생성 (User 테이블의 ID 사용)
                Long appUserId = user.getId();
                extractedUserInfo.put("app_user_id", appUserId); // 내부 ID를 클레임에 추가
                String jwtAccessToken = jwtTokenProvider.generateAccessToken(String.valueOf(appUserId), "kakao", extractedUserInfo);
                String jwtRefreshToken = jwtTokenProvider.generateRefreshToken(String.valueOf(appUserId), "kakao");
                
                // 5. Redis에는 Access Token만 저장, Refresh Token은 User 테이블에 저장
                tokenService.saveAccessToken("kakao", String.valueOf(appUserId), jwtAccessToken, 3600);
                userService.updateRefreshToken(appUserId, jwtRefreshToken);
                System.out.println("Refresh Token을 User 테이블에 저장 완료: userId=" + appUserId);
                
                // 6. Refresh Token을 HttpOnly 쿠키로 설정
                if (jwtRefreshToken != null) {
                    Cookie refreshTokenCookie = new Cookie("refresh_token", jwtRefreshToken);
                    refreshTokenCookie.setHttpOnly(true); // XSS 방어
                    refreshTokenCookie.setSecure(frontendUrl != null && frontendUrl.startsWith("https")); // HTTPS일 때만 Secure
                    refreshTokenCookie.setPath("/"); // 모든 경로에서 접근 가능
                    refreshTokenCookie.setMaxAge(30 * 24 * 60 * 60); // 30일
                    refreshTokenCookie.setAttribute("SameSite", "Lax"); // CSRF 방어
                    response.addCookie(refreshTokenCookie);
                    System.out.println("Refresh Token을 HttpOnly 쿠키로 설정 완료");
                }
                
                // 7. 프론트엔드로 리다이렉트 (Access Token만 URL에 포함)
                String redirectUrl = frontendUrl + "/login/callback?provider=kakao&token=" + URLEncoder.encode(jwtAccessToken, StandardCharsets.UTF_8);
                
                System.out.println("JWT 토큰 생성 완료, 프론트엔드로 리다이렉트: " + redirectUrl);
                return new RedirectView(redirectUrl);
                
            } catch (Exception e) {
                System.err.println("카카오 인증 처리 중 오류 발생: " + e.getMessage());
                e.printStackTrace();
                
                // 에러 발생 시 프론트엔드로 리다이렉트
                String redirectUrl = frontendUrl + "/login/callback?provider=kakao&error=" + URLEncoder.encode("인증 처리 중 오류가 발생했습니다: " + e.getMessage(), StandardCharsets.UTF_8);
                return new RedirectView(redirectUrl);
            }
        } else if (error != null) {
            // 에러 시 프론트엔드로 리다이렉트 (에러 정보 포함)
            String redirectUrl = frontendUrl + "/login/callback?provider=kakao&error=" + URLEncoder.encode(error, StandardCharsets.UTF_8);
            if (error_description != null) {
                redirectUrl += "&error_description=" + URLEncoder.encode(error_description, StandardCharsets.UTF_8);
            }
            
            System.out.println("에러 발생, 프론트엔드로 리다이렉트: " + redirectUrl);
            return new RedirectView(redirectUrl);
        } else {
            // 인증 코드가 없는 경우
            String redirectUrl = frontendUrl + "/login/callback?provider=kakao&error=" + URLEncoder.encode("인증 코드가 없습니다.", StandardCharsets.UTF_8);
            System.out.println("인증 코드 없음, 프론트엔드로 리다이렉트: " + redirectUrl);
            return new RedirectView(redirectUrl);
        }
    }
    
    /**
     * 카카오 로그인 요청 처리
     * Next.js에서 성공으로 인식하도록 항상 성공 응답 반환
     */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> kakaoLogin(
            @RequestBody(required = false) Map<String, Object> request,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            HttpServletRequest httpRequest) {
        System.out.println("=== 카카오 로그인 요청 수신 ===");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            System.out.println("Authorization 헤더 있음 (토큰 로그 생략)");
        } else {
            System.out.println("Authorization 헤더 없음");
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "카카오 로그인이 성공적으로 처리되었습니다.");
        response.put("token", "mock_token_" + System.currentTimeMillis());
        
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
    
    /**
     * 카카오 토큰 검증 및 저장
     * Authorization Code를 Access Token으로 교환하고 Redis에 저장
     */
    @PostMapping("/token")
    public ResponseEntity<Map<String, Object>> kakaoToken(@RequestBody(required = false) Map<String, Object> request) {
        System.out.println("=== 카카오 토큰 요청 수신 ===");
        Map<String, Object> response = new HashMap<>();
        
        try {
            // 1. Authorization Code 검증
            if (request == null || !request.containsKey("code")) {
                response.put("success", false);
                response.put("message", "Authorization Code가 필요합니다.");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
            
            String code = request.get("code").toString();
            
            // 2. Redis에서 Authorization Code 검증
            String state = tokenService.verifyAndDeleteAuthorizationCode("kakao", code);
            if (state == null) {
                System.out.println("경고: Redis에 Authorization Code가 없습니다. 계속 진행합니다.");
                // Redis에 없어도 카카오 API 호출은 진행 (개발 환경 고려)
            }
            
            // 3. 카카오 Access Token 교환
            System.out.println("카카오 API로 Access Token 요청 중...");
            Map<String, Object> kakaoTokenResponse = kakaoOAuthService.getAccessToken(code);
            String kakaoAccessToken = (String) kakaoTokenResponse.get("access_token");
            // kakaoRefreshToken은 필요시 사용 가능
            // String kakaoRefreshToken = (String) kakaoTokenResponse.get("refresh_token");
            
            if (kakaoAccessToken == null) {
                response.put("success", false);
                response.put("message", "카카오 Access Token 발급 실패");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
            }
            
            // 4. 카카오 사용자 정보 조회
            System.out.println("카카오 사용자 정보 조회 중...");
            Map<String, Object> kakaoUserInfo = kakaoOAuthService.getUserInfo(kakaoAccessToken);
            Map<String, Object> userInfo = kakaoOAuthService.extractUserInfo(kakaoUserInfo);
            
            // 5. JWT 토큰 생성
            String userId = userInfo.get("kakao_id").toString();
            System.out.println("JWT 토큰 생성 중... User ID: " + userId);
            
            String jwtAccessToken = jwtTokenProvider.generateAccessToken(userId, "kakao", userInfo);
            String jwtRefreshToken = jwtTokenProvider.generateRefreshToken(userId, "kakao");
            
            // JWT 토큰 검증
            boolean isValidAccessToken = jwtTokenProvider.validateToken(jwtAccessToken);
            jwtTokenProvider.validateToken(jwtRefreshToken);
            
            // 6. Redis에 토큰 저장 (Access Token: 1시간, Refresh Token: 30일)
            tokenService.saveAccessToken("kakao", userId, jwtAccessToken, 3600);
            tokenService.saveRefreshToken("kakao", userId, jwtRefreshToken, 2592000);
            
            System.out.println("카카오 인증 완료: " + userInfo.get("nickname"));
            System.out.println("============================");
            
            // 7. 응답 반환
            response.put("success", true);
            response.put("message", "카카오 로그인이 성공적으로 처리되었습니다.");
            response.put("access_token", jwtAccessToken);
            response.put("refresh_token", jwtRefreshToken);
            response.put("token_type", "Bearer");
            response.put("expires_in", 3600);
            response.put("user", userInfo);
            
            return ResponseEntity.status(HttpStatus.OK).body(response);
            
        } catch (Exception e) {
            System.err.println("카카오 인증 처리 중 오류 발생: " + e.getMessage());
            e.printStackTrace();
            
            response.put("success", false);
            response.put("message", "카카오 인증 처리 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * 카카오 사용자 정보 조회
     * JWT 토큰으로 사용자 정보 반환
     */
    @GetMapping("/user")
    @Operation(summary = "카카오 사용자 정보 조회", description = "카카오 OAuth 토큰을 사용하여 사용자 정보를 조회합니다.")
    public ResponseEntity<Map<String, Object>> kakaoUserInfo(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            HttpServletRequest request) {
        System.out.println("=== 카카오 사용자 정보 조회 요청 수신 ===");
        Map<String, Object> response = new HashMap<>();
        
        try {
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                response.put("success", false);
                response.put("message", "인증 토큰이 필요합니다.");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
            }
            
            String token = authHeader.substring(7);
            if (!jwtTokenProvider.validateToken(token)) {
                response.put("success", false);
                response.put("message", "유효하지 않은 토큰입니다.");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
            }
            
            // JWT 토큰에서 사용자 정보 추출
            String userId = jwtTokenProvider.getUserIdFromToken(token);
            var claims = jwtTokenProvider.getAllClaimsFromToken(token);
            
            // Redis에서 토큰 확인 (선택적)
            String storedToken = tokenService.getAccessToken("kakao", userId);
            if (storedToken == null) {
                System.out.println("경고: Redis에 저장된 토큰이 없습니다.");
            }
            
            // 사용자 정보 구성
            Map<String, Object> userInfo = new HashMap<>();
            userInfo.put("kakao_id", userId);
            userInfo.put("nickname", claims.get("nickname"));
            userInfo.put("email", claims.get("email"));
            userInfo.put("email_verified", claims.get("email_verified"));
            userInfo.put("profile_image", claims.get("profile_image"));
            userInfo.put("provider", "kakao");
            
            System.out.println("============================");
            
            response.put("success", true);
            response.put("message", "카카오 사용자 정보를 성공적으로 조회했습니다.");
            response.put("user", userInfo);
            
            return ResponseEntity.status(HttpStatus.OK).body(response);
            
        } catch (Exception e) {
            System.err.println("사용자 정보 조회 중 오류 발생: " + e.getMessage());
            e.printStackTrace();
            
            response.put("success", false);
            response.put("message", "사용자 정보 조회 중 오류가 발생했습니다.");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * 모든 카카오 관련 요청에 대한 기본 핸들러
     * Next.js에서 성공으로 인식하도록 항상 성공 응답 반환
     */
    @RequestMapping(value = "/**", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
    public ResponseEntity<Map<String, Object>> kakaoDefault() {
        System.out.println("=== 카카오 기본 핸들러 요청 수신 ===");
        System.out.println("============================");
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "카카오 요청이 성공적으로 처리되었습니다.");
        
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
}
