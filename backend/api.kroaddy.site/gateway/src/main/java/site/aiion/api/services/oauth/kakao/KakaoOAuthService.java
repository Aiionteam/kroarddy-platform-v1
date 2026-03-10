package site.aiion.api.services.oauth.kakao;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * 카카오 OAuth2 인증 서비스
 * 카카오 API와 통신하여 토큰 교환 및 사용자 정보 조회
 */
@Service
public class KakaoOAuthService {
    
    @Value("${kakao.client-id}")
    private String clientId;
    
    @Value("${kakao.client-secret:}")
    private String clientSecret;
    
    @Value("${kakao.redirect-uri}")
    private String redirectUri;
    
    private final RestTemplate restTemplate;
    
    // 카카오 API 엔드포인트
    private static final String KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";
    private static final String KAKAO_USER_INFO_URL = "https://kapi.kakao.com/v2/user/me";
    
    public KakaoOAuthService() {
        this.restTemplate = new RestTemplate();
    }
    
    /**
     * Authorization Code를 Access Token으로 교환
     * @param code Authorization Code
     * @return 카카오 토큰 응답 (access_token, refresh_token, expires_in 등)
     */
    public Map<String, Object> getAccessToken(String code) {
        System.out.println("=== 카카오 Access Token 요청 ===");
        // 요청 파라미터 설정
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "authorization_code");
        params.add("client_id", clientId);
        params.add("redirect_uri", redirectUri);
        params.add("code", code);
        
        // Client Secret이 있으면 추가 (보안 강화)
        if (clientSecret != null && !clientSecret.isEmpty()) {
            params.add("client_secret", clientSecret);
        }
        
        // 헤더 설정
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        
        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);
        
        try {
            // 카카오 토큰 API 호출
            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> response = restTemplate.postForEntity(
                KAKAO_TOKEN_URL,
                request,
                Map.class
            );
            
            @SuppressWarnings("unchecked")
            Map<String, Object> body = response.getBody();
            return body;
        } catch (Exception e) {
            System.err.println("카카오 토큰 요청 실패: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("카카오 토큰 요청 실패", e);
        }
    }
    
    /**
     * Access Token으로 카카오 사용자 정보 조회
     * @param accessToken 카카오 Access Token
     * @return 사용자 정보 (id, nickname, email 등)
     */
    public Map<String, Object> getUserInfo(String accessToken) {
        System.out.println("=== 카카오 사용자 정보 요청 ===");
        // 헤더 설정
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + accessToken);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        
        HttpEntity<String> request = new HttpEntity<>(headers);
        
        try {
            // 카카오 사용자 정보 API 호출
            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> response = restTemplate.exchange(
                KAKAO_USER_INFO_URL,
                HttpMethod.GET,
                request,
                Map.class
            );
            
            @SuppressWarnings("unchecked")
            Map<String, Object> body = response.getBody();
            return body;
        } catch (Exception e) {
            System.err.println("카카오 사용자 정보 요청 실패: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("카카오 사용자 정보 요청 실패", e);
        }
    }
    
    /**
     * 카카오 사용자 정보에서 필요한 데이터 추출
     * @param userInfo 카카오 API 응답
     * @return 추출된 사용자 정보
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> extractUserInfo(Map<String, Object> userInfo) {
        // 카카오 사용자 ID
        Long kakaoId = ((Number) userInfo.get("id")).longValue();
        
        // 카카오 계정 정보
        Map<String, Object> kakaoAccount = (Map<String, Object>) userInfo.get("kakao_account");
        
        // 프로필 정보
        Map<String, Object> profile = null;
        String nickname = null;
        String profileImage = null;
        
        if (kakaoAccount != null && kakaoAccount.containsKey("profile")) {
            profile = (Map<String, Object>) kakaoAccount.get("profile");
            nickname = (String) profile.get("nickname");
            profileImage = (String) profile.get("profile_image_url");
        }
        
        // 이메일 정보
        String email = null;
        Boolean emailVerified = false;
        if (kakaoAccount != null) {
            email = (String) kakaoAccount.get("email");
            emailVerified = (Boolean) kakaoAccount.getOrDefault("is_email_verified", false);
        }
        
        // 가변 Map을 반환하여 이후 수정 가능하도록 함
        Map<String, Object> extractedInfo = new HashMap<>();
        extractedInfo.put("kakao_id", kakaoId);
        extractedInfo.put("nickname", nickname != null ? nickname : "카카오 사용자");
        extractedInfo.put("email", email != null ? email : "");
        extractedInfo.put("email_verified", emailVerified);
        extractedInfo.put("profile_image", profileImage != null ? profileImage : "");
        
        return extractedInfo;
    }
}

