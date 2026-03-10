package site.aiion.api.services.oauth.google;

import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;
import site.aiion.api.services.oauth.token.TokenService;
import site.aiion.api.services.oauth.util.JwtTokenProvider;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/google")
public class GoogleController {
    
    private final TokenService tokenService;
    private final GoogleOAuthService googleOAuthService;
    private final JwtTokenProvider jwtTokenProvider;
    private final site.aiion.api.services.user.UserService userService;
    
    public GoogleController(
            TokenService tokenService,
            GoogleOAuthService googleOAuthService,
            JwtTokenProvider jwtTokenProvider,
            site.aiion.api.services.user.UserService userService) {
        this.tokenService = tokenService;
        this.googleOAuthService = googleOAuthService;
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
     * 구글 인증 URL 제공
     * 프론트엔드에서 CLIENT ID를 노출하지 않고 인증 URL을 가져올 수 있도록 함
     */
    @GetMapping("/auth-url")
    @Operation(summary = "구글 인증 URL 생성", description = "구글 OAuth 인증을 위한 URL을 생성합니다.")
    public ResponseEntity<Map<String, Object>> getGoogleAuthUrl(
            @RequestParam(required = false) String frontend_url,
            HttpServletRequest request) {
        // 환경 변수에서 가져오기
        String clientId = System.getenv("GOOGLE_CLIENT_ID");
        String redirectUri = System.getenv("GOOGLE_REDIRECT_URI");
        
        // 프론트엔드 URL 확인 (파라미터 또는 Referer 헤더 또는 환경변수)
        if (frontend_url == null || frontend_url.isEmpty()) {
            String referer = request.getHeader("Referer");
            if (referer != null && !referer.isEmpty()) {
                // Referer에서 origin 추출 (예: http://localhost:3000)
                try {
                    java.net.URL refererUrl = new java.net.URL(referer);
                    frontend_url = refererUrl.getProtocol() + "://" + refererUrl.getAuthority();
                } catch (Exception e) {
                    // 파싱 실패 시 무시
                }
            }
        }
        
        // 여전히 없으면 환경변수나 기본값 사용
        if (frontend_url == null || frontend_url.isEmpty()) {
            frontend_url = System.getenv("FRONTEND_URL");
            if (frontend_url == null || frontend_url.isEmpty()) {
                frontend_url = "http://localhost:3000";
            }
        }
        
        String csrfToken = UUID.randomUUID().toString(); // CSRF 방지용 토큰
        // State에 프론트엔드 URL과 CSRF 토큰을 인코딩: "frontend_url|csrf_token"
        String state = URLEncoder.encode(frontend_url, StandardCharsets.UTF_8) + "|" + csrfToken;
        
        String authUrl = String.format(
            "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=%s&redirect_uri=%s&scope=openid%%20profile%%20email&state=%s",
            clientId,
            URLEncoder.encode(redirectUri, StandardCharsets.UTF_8),
            URLEncoder.encode(state, StandardCharsets.UTF_8)
        );
        
        return ResponseEntity.ok(Map.of(
            "success", true,
            "auth_url", authUrl
        ));
    }
    
    /**
     * 구글 인증 콜백 처리
     * Authorization Code를 받아서 바로 토큰 교환 및 JWT 생성 후 프론트엔드로 리다이렉트
     */
    @GetMapping("/callback")
    @Operation(summary = "구글 OAuth 콜백", description = "구글 OAuth 인증 후 콜백을 처리합니다.")
    public RedirectView googleCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(required = false) String error_description,
            HttpServletResponse response) {
        
        System.out.println("=== 구글 콜백 요청 수신 ===");
        System.out.println("Code: " + code);
        System.out.println("State: " + state);
        System.out.println("Error: " + error);
        System.out.println("Error Description: " + error_description);
        System.out.println("============================");
        
        // State에서 프론트엔드 URL 추출
        String frontendUrl = null;
        if (state != null && !state.isEmpty()) {
            try {
                // State 형식: "frontend_url|csrf_token" 또는 단순 URL
                String decodedState = java.net.URLDecoder.decode(state, StandardCharsets.UTF_8);
                if (decodedState.contains("|")) {
                    // "frontend_url|csrf_token" 형식인 경우
                    String[] parts = decodedState.split("\\|", 2);
                    if (parts.length > 0 && !parts[0].isEmpty()) {
                        frontendUrl = parts[0];
                    }
                } else {
                    // 단순 URL인 경우 (하위 호환성)
                    frontendUrl = decodedState;
                }
            } catch (Exception e) {
                System.err.println("State 파싱 오류: " + e.getMessage());
            }
        }
        
        // State에서 프론트엔드 URL을 추출하지 못한 경우 기본값 사용
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
                Map<String, Object> tokenResponse = googleOAuthService.getAccessToken(code);
                String accessToken = (String) tokenResponse.get("access_token");
                String refreshToken = (String) tokenResponse.get("refresh_token");
                
                if (accessToken == null) {
                    throw new RuntimeException("구글 Access Token을 받을 수 없습니다.");
                }
                
                // 2. Access Token으로 사용자 정보 조회
                Map<String, Object> userInfo = googleOAuthService.getUserInfo(accessToken);
                Map<String, Object> extractedUserInfo = googleOAuthService.extractUserInfo(userInfo);
                
                // 3. User 테이블에서 사용자 조회 또는 생성
                // 전략: providerId(sub)는 변하지 않으므로 우선 사용, email은 보조로 사용
                String email = (String) extractedUserInfo.get("email");
                String name = (String) extractedUserInfo.get("nickname");
                String providerId = (String) extractedUserInfo.get("google_id"); // sub 또는 id
                
                site.aiion.api.services.oauth.user.UserResponse user = null;
                
                // 1단계: providerId + provider로 조회 (가장 안정적, sub는 변하지 않음)
                if (providerId != null && !providerId.trim().isEmpty()) {
                    System.out.println("[GoogleController] providerId로 사용자 조회 시도: " + providerId);
                    site.aiion.api.services.user.common.domain.Messenger findResult = userService.findByProviderIdAndProvider(providerId, "google");
                    user = extractUserFromMessenger(findResult);
                    if (user != null) {
                        System.out.println("[GoogleController] providerId로 기존 사용자 조회 성공: ID=" + user.getId() + ", providerId=" + providerId);
                    }
                }
                
                // 2단계: providerId로 못 찾았으면 email + provider로 조회 (하위 호환성)
                if (user == null && email != null && !email.trim().isEmpty()) {
                    System.out.println("[GoogleController] email로 사용자 조회 시도: " + email);
                    site.aiion.api.services.user.common.domain.Messenger findResult = userService.findByEmailAndProvider(email, "google");
                    user = extractUserFromMessenger(findResult);
                    if (user != null) {
                        System.out.println("[GoogleController] email로 기존 사용자 조회 성공: ID=" + user.getId() + ", email=" + email);
                    }
                }
                
                // 3단계: 없으면 새로 생성
                if (user == null) {
                    System.out.println("[GoogleController] 사용자 없음, 새로 생성 시도: providerId=" + providerId + ", email=" + email);
                    site.aiion.api.services.user.UserModel newUser = site.aiion.api.services.user.UserModel.builder()
                            .name(name)
                            .email(email)
                            .nickname(name)
                            .provider("google")
                            .providerId(providerId)
                            .build();
                    site.aiion.api.services.user.common.domain.Messenger saveResult = userService.save(newUser);
                    user = extractUserFromMessenger(saveResult);
                    
                    // 4단계: 생성 실패 시 (중복 키 등으로 이미 생성됨) 다시 조회
                    if (user == null) {
                        System.out.println("[GoogleController] 사용자 생성 실패 (중복 가능), 재조회: providerId=" + providerId);
                        if (providerId != null && !providerId.trim().isEmpty()) {
                            site.aiion.api.services.user.common.domain.Messenger findResult = userService.findByProviderIdAndProvider(providerId, "google");
                            user = extractUserFromMessenger(findResult);
                        }
                        if (user == null && email != null && !email.trim().isEmpty()) {
                            site.aiion.api.services.user.common.domain.Messenger findResult = userService.findByEmailAndProvider(email, "google");
                            user = extractUserFromMessenger(findResult);
                        }
                    }
                    
                    // 최종 확인: 그래도 없으면 에러
                    if (user == null || user.getId() == null) {
                        throw new RuntimeException("사용자 생성 및 조회 실패 - user-service와 통신에 문제가 있습니다. providerId: " + providerId + ", email: " + email);
                    }
                    System.out.println("[GoogleController] 사용자 생성 완료: ID=" + user.getId() + ", providerId=" + providerId + ", email=" + email);
                }
                
                // 4. JWT 토큰 생성 (User 테이블의 ID 사용)
                Long appUserId = user.getId();
                extractedUserInfo.put("app_user_id", appUserId); // 내부 ID를 클레임에 추가
                String jwtAccessToken = jwtTokenProvider.generateAccessToken(String.valueOf(appUserId), "google", extractedUserInfo);
                String jwtRefreshToken = jwtTokenProvider.generateRefreshToken(String.valueOf(appUserId), "google");
                
                // 5. Redis에는 Access Token만 저장, Refresh Token은 User 테이블에 저장
                tokenService.saveAccessToken("google", String.valueOf(appUserId), jwtAccessToken, 3600);
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
                String redirectUrl = frontendUrl + "/login/callback?provider=google&token=" + URLEncoder.encode(jwtAccessToken, StandardCharsets.UTF_8);
                
                System.out.println("JWT 토큰 생성 완료, 프론트엔드로 리다이렉트: " + redirectUrl);
                return new RedirectView(redirectUrl);
                
            } catch (Exception e) {
                System.err.println("구글 인증 처리 중 오류 발생: " + e.getMessage());
                e.printStackTrace();
                
                // 에러 발생 시 프론트엔드로 리다이렉트
                String redirectUrl = frontendUrl + "/login/callback?provider=google&error=" + URLEncoder.encode("인증 처리 중 오류가 발생했습니다: " + e.getMessage(), StandardCharsets.UTF_8);
                return new RedirectView(redirectUrl);
            }
        } else if (error != null) {
            // 에러 시 프론트엔드로 리다이렉트 (에러 정보 포함)
            String redirectUrl = frontendUrl + "/login/callback?provider=google&error=" + URLEncoder.encode(error, StandardCharsets.UTF_8);
            if (error_description != null) {
                redirectUrl += "&error_description=" + URLEncoder.encode(error_description, StandardCharsets.UTF_8);
            }
            
            System.out.println("에러 발생, 프론트엔드로 리다이렉트: " + redirectUrl);
            return new RedirectView(redirectUrl);
        } else {
            // 인증 코드가 없는 경우
            String redirectUrl = frontendUrl + "/login/callback?provider=google&error=" + URLEncoder.encode("인증 코드가 없습니다.", StandardCharsets.UTF_8);
            System.out.println("인증 코드 없음, 프론트엔드로 리다이렉트: " + redirectUrl);
            return new RedirectView(redirectUrl);
        }
    }
    
    /**
     * 구글 로그인 요청 처리
     * Next.js에서 성공으로 인식하도록 항상 성공 응답 반환
     */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> googleLogin(
            @RequestBody(required = false) Map<String, Object> request,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            HttpServletRequest httpRequest) {
        System.out.println("=== 구글 로그인 요청 수신 ===");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            System.out.println("Authorization 헤더 있음 (토큰 로그 생략)");
        } else {
            System.out.println("Authorization 헤더 없음");
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "구글 로그인이 성공적으로 처리되었습니다.");
        response.put("token", "mock_token_" + System.currentTimeMillis());
        
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
    
    /**
     * 구글 토큰 검증 및 저장
     * Authorization Code를 Access Token으로 교환하고 Redis에 저장
     */
    @PostMapping("/token")
    public ResponseEntity<Map<String, Object>> googleToken(@RequestBody(required = false) Map<String, Object> request) {
        System.out.println("=== 구글 토큰 요청 수신 ===");
        
        Map<String, Object> response = new HashMap<>();
        
        if (request == null || !request.containsKey("code")) {
            response.put("success", false);
            response.put("message", "Authorization Code가 필요합니다.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
        
        String code = request.get("code").toString();
        String requestState = request.containsKey("state") ? request.get("state").toString() : null;
        
        // Redis에서 Authorization Code 검증
        String savedState = tokenService.verifyAndDeleteAuthorizationCode("google", code);
        if (savedState == null) {
            response.put("success", false);
            response.put("message", "유효하지 않거나 만료된 Authorization Code입니다.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
        
        // State 검증 (있는 경우)
        if (requestState != null && !requestState.equals(savedState)) {
            response.put("success", false);
            response.put("message", "State 값이 일치하지 않습니다.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
        
        // TODO: 실제 구글 OAuth2 API를 호출하여 Access Token 교환
        // 현재는 Mock 응답
        String accessToken = "mock_access_token_" + System.currentTimeMillis();
        String refreshToken = "mock_refresh_token_" + System.currentTimeMillis();
        String userId = "mock_google_user_id"; // 실제로는 구글 API에서 받아온 사용자 ID
        
        // Redis에 토큰 저장 (Access Token: 1시간, Refresh Token: 30일)
        tokenService.saveAccessToken("google", userId, accessToken, 3600);
        tokenService.saveRefreshToken("google", userId, refreshToken, 2592000);
        
        response.put("success", true);
        response.put("message", "구글 토큰이 성공적으로 처리되었습니다.");
        response.put("access_token", accessToken);
        response.put("refresh_token", refreshToken);
        response.put("user_id", userId);
        
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
    
    /**
     * 구글 사용자 정보 조회
     * Next.js에서 성공으로 인식하도록 항상 성공 응답 반환
     */
    @GetMapping("/user")
    @Operation(summary = "구글 사용자 정보 조회", description = "구글 OAuth 토큰을 사용하여 사용자 정보를 조회합니다.")
    public ResponseEntity<Map<String, Object>> googleUserInfo(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            HttpServletRequest request) {
        System.out.println("=== 구글 사용자 정보 조회 요청 수신 ===");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            System.out.println("Authorization 헤더 있음 (토큰 로그 생략)");
        } else {
            System.out.println("Authorization 헤더 없음");
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "구글 사용자 정보를 성공적으로 조회했습니다.");
        
        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("id", "mock_google_user_id");
        userInfo.put("nickname", "구글 사용자");
        userInfo.put("email", "google@example.com");
        
        response.put("user", userInfo);
        
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
    
    /**
     * 모든 구글 관련 요청에 대한 기본 핸들러
     * Next.js에서 성공으로 인식하도록 항상 성공 응답 반환
     */
    @RequestMapping(value = "/**", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
    public ResponseEntity<Map<String, Object>> googleDefault() {
        System.out.println("=== 구글 기본 핸들러 요청 수신 ===");
        System.out.println("============================");
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "구글 요청이 성공적으로 처리되었습니다.");
        
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
}
