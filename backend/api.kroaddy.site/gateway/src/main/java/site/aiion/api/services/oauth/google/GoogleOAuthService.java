package site.aiion.api.services.oauth.google;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * 구글 OAuth2 인증 서비스
 * 구글 API와 통신하여 토큰 교환 및 사용자 정보 조회
 */
@Service
public class GoogleOAuthService {
    
    @Value("${google.client-id}")
    private String clientId;
    
    @Value("${google.client-secret}")
    private String clientSecret;
    
    @Value("${google.redirect-uri}")
    private String redirectUri;
    
    private final RestTemplate restTemplate;
    
    // 구글 API 엔드포인트
    private static final String GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String GOOGLE_USER_INFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
    
    public GoogleOAuthService() {
        this.restTemplate = new RestTemplate();
    }
    
    /**
     * Authorization Code를 Access Token으로 교환
     * @param code Authorization Code
     * @return 구글 토큰 응답 (access_token, refresh_token, expires_in 등)
     */
    public Map<String, Object> getAccessToken(String code) {
        System.out.println("=== 구글 Access Token 요청 ===");
        // 요청 파라미터 설정
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "authorization_code");
        params.add("client_id", clientId);
        params.add("client_secret", clientSecret);
        params.add("redirect_uri", redirectUri);
        params.add("code", code);
        
        // 헤더 설정
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        
        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);
        
        try {
            // 구글 토큰 API 호출
            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> response = restTemplate.postForEntity(
                GOOGLE_TOKEN_URL,
                request,
                Map.class
            );
            
            @SuppressWarnings("unchecked")
            Map<String, Object> body = response.getBody();
            return body;
        } catch (Exception e) {
            System.err.println("구글 토큰 요청 실패: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("구글 토큰 요청 실패", e);
        }
    }
    
    /**
     * Access Token으로 구글 사용자 정보 조회
     * @param accessToken 구글 Access Token
     * @return 사용자 정보 (id, name, email 등)
     */
    public Map<String, Object> getUserInfo(String accessToken) {
        System.out.println("=== 구글 사용자 정보 요청 ===");
        // 헤더 설정
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        HttpEntity<String> request = new HttpEntity<>(headers);
        
        try {
            // 구글 사용자 정보 API 호출
            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> response = restTemplate.exchange(
                GOOGLE_USER_INFO_URL,
                HttpMethod.GET,
                request,
                Map.class
            );
            
            System.out.println("구글 사용자 정보 응답: " + response.getBody());
            System.out.println("================================");
            
            @SuppressWarnings("unchecked")
            Map<String, Object> body = response.getBody();
            return body;
        } catch (Exception e) {
            System.err.println("구글 사용자 정보 요청 실패: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("구글 사용자 정보 요청 실패", e);
        }
    }
    
    /**
     * 구글 사용자 정보에서 필요한 데이터 추출
     * @param userInfo 구글 API 응답
     * @return 추출된 사용자 정보
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> extractUserInfo(Map<String, Object> userInfo) {
        // 구글 사용자 ID (OpenID Connect의 sub 우선 사용, 없으면 id 사용)
        // sub는 OpenID Connect 표준이며 변하지 않는 고유 식별자입니다.
        String sub = (String) userInfo.get("sub");
        String googleId = sub != null ? sub : (String) userInfo.get("id");
        
        // 이름
        String name = (String) userInfo.get("name");
        
        // 이메일
        String email = (String) userInfo.get("email");
        
        // 프로필 이미지
        String picture = (String) userInfo.get("picture");
        
        // 이메일 인증 여부
        Boolean emailVerified = (Boolean) userInfo.getOrDefault("verified_email", false);
        
        // 가변 Map을 반환하여 이후 수정 가능하도록 함
        Map<String, Object> extractedInfo = new HashMap<>();
        extractedInfo.put("google_id", googleId != null ? googleId : "");
        extractedInfo.put("sub", sub != null ? sub : googleId); // OpenID Connect 표준 필드
        extractedInfo.put("nickname", name != null ? name : "구글 사용자");
        extractedInfo.put("email", email != null ? email : "");
        extractedInfo.put("email_verified", emailVerified != null ? emailVerified : false);
        extractedInfo.put("profile_image", picture != null ? picture : "");
        
        System.out.println("[GoogleOAuthService] 사용자 정보 추출:");
        System.out.println("  - sub: " + sub);
        System.out.println("  - id: " + userInfo.get("id"));
        System.out.println("  - 최종 google_id: " + googleId);
        System.out.println("  - email: " + email);
        
        return extractedInfo;
    }
}

