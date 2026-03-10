package site.aiion.api.services.oauth.user;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * user-service와 통신하는 클라이언트
 */
@Component
public class UserServiceClient {
    
    private final RestTemplate restTemplate;
    
    @Value("${user.service.url:http://user-service:8082}")
    private String userServiceUrl;
    
    public UserServiceClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }
    
    /**
     * 이메일과 제공자로 사용자 조회
     * 컨테이너 간 직접 통신이므로 게이트웨이 경로(/user) 제외
     * 
     * @return 사용자가 있으면 UserResponse 반환, 없으면 null 반환
     */
    public UserResponse findByEmailAndProvider(String email, String provider) {
        try {
            String encodedEmail = URLEncoder.encode(email != null ? email : "", StandardCharsets.UTF_8);
            String encodedProvider = URLEncoder.encode(provider != null ? provider : "", StandardCharsets.UTF_8);
            String url = userServiceUrl + "/users/findByEmailAndProvider?email=" + encodedEmail + "&provider=" + encodedProvider;
            
            System.out.println("[UserServiceClient] 사용자 조회 요청: " + url);
            
            ResponseEntity<Map> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                Map.class
            );
            
            Map<String, Object> body = response.getBody();
            System.out.println("[UserServiceClient] 응답 전체 body: " + body);
            
            if (body != null) {
                // Code 또는 code 필드 확인 (대소문자 모두 대응)
                Integer code = null;
                if (body.containsKey("Code")) {
                    Object codeObj = body.get("Code");
                    if (codeObj instanceof Number) {
                        code = ((Number) codeObj).intValue();
                    }
                } else if (body.containsKey("code")) {
                    Object codeObj = body.get("code");
                    if (codeObj instanceof Number) {
                        code = ((Number) codeObj).intValue();
                    }
                }
                
                System.out.println("[UserServiceClient] 파싱된 응답 코드: " + code);
                
                if (code != null && code == 200) {
                    Map<String, Object> data = (Map<String, Object>) body.get("data");
                    if (data != null) {
                        UserResponse userResponse = UserResponse.builder()
                            .id(((Number) data.get("id")).longValue())
                            .name((String) data.get("name"))
                            .email((String) data.get("email"))
                            .nickname((String) data.get("nickname"))
                            .provider((String) data.get("provider"))
                            .providerId((String) data.get("providerId"))
                            .build();
                        System.out.println("[UserServiceClient] 사용자 조회 성공: ID=" + userResponse.getId() + ", email=" + email);
                        return userResponse;
                    }
                }
                // 404 또는 다른 코드는 사용자 없음으로 간주
                System.out.println("[UserServiceClient] 사용자 없음 (코드: " + code + "), email: " + email);
            }
            return null;
        } catch (HttpClientErrorException e) {
            // 404는 사용자 없음을 의미 (정상 케이스)
            if (e.getStatusCode().value() == 404) {
                System.out.println("[UserServiceClient] 사용자 없음 (404), email: " + email);
                return null;
            }
            // 다른 4xx 에러는 예외로 처리
            System.err.println("[UserServiceClient] 사용자 조회 클라이언트 에러: " + e.getStatusCode() + ", email: " + email);
            e.printStackTrace();
            return null;
        } catch (Exception e) {
            System.err.println("[UserServiceClient] 사용자 조회 예외 발생: " + e.getMessage() + ", email: " + email);
            e.printStackTrace();
            return null;
        }
    }
    
    /**
     * 사용자 저장
     * 컨테이너 간 직접 통신이므로 게이트웨이 경로(/user) 제외
     */
    public UserResponse saveUser(String name, String email, String provider, String providerId) {
        String url = userServiceUrl + "/users";
        
        // nickname 초기값은 name과 동일하게 설정
        String nickname = name != null ? name : "";
        
        Map<String, Object> requestBody = Map.of(
            "name", name != null ? name : "",
            "email", email != null ? email : "",
            "nickname", nickname,
            "provider", provider != null ? provider : "",
            "providerId", providerId != null ? providerId : ""
        );
        
        System.out.println("[UserServiceClient] 사용자 저장 요청 시작");
        System.out.println("[UserServiceClient] URL: " + url);
        System.out.println("[UserServiceClient] 요청 body: " + requestBody);
        System.out.println("[UserServiceClient] userServiceUrl 설정값: " + userServiceUrl);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
        
        try {
            System.out.println("[UserServiceClient] RestTemplate 호출 시작...");
            ResponseEntity<Map> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                request,
                Map.class
            );
            
            System.out.println("[UserServiceClient] RestTemplate 호출 완료");
            System.out.println("[UserServiceClient] HTTP 상태 코드: " + response.getStatusCode());
            System.out.println("[UserServiceClient] 응답 헤더: " + response.getHeaders());
            
            Map<String, Object> body = response.getBody();
            System.out.println("[UserServiceClient] 응답 전체 body: " + body);
            System.out.println("[UserServiceClient] 응답 body 타입: " + (body != null ? body.getClass() : "null"));
            
            if (body != null) {
                System.out.println("[UserServiceClient] body 키 목록: " + body.keySet());
                
                // Code 또는 code 필드 확인 (대소문자 모두 대응)
                Integer code = null;
                if (body.containsKey("Code")) {
                    Object codeObj = body.get("Code");
                    System.out.println("[UserServiceClient] Code 필드 발견: " + codeObj + " (타입: " + (codeObj != null ? codeObj.getClass() : "null") + ")");
                    if (codeObj instanceof Number) {
                        code = ((Number) codeObj).intValue();
                    } else if (codeObj instanceof Integer) {
                        code = (Integer) codeObj;
                    }
                } else if (body.containsKey("code")) {
                    Object codeObj = body.get("code");
                    System.out.println("[UserServiceClient] code 필드 발견: " + codeObj + " (타입: " + (codeObj != null ? codeObj.getClass() : "null") + ")");
                    if (codeObj instanceof Number) {
                        code = ((Number) codeObj).intValue();
                    } else if (codeObj instanceof Integer) {
                        code = (Integer) codeObj;
                    }
                } else {
                    System.out.println("[UserServiceClient] Code/code 필드를 찾을 수 없습니다. body: " + body);
                }
                
                System.out.println("[UserServiceClient] 파싱된 응답 코드: " + code);
                
                // 200 또는 409 (중복 키 - 기존 사용자 반환) 모두 성공으로 처리
                if (code != null && (code == 200 || code == 409)) {
                    Map<String, Object> data = (Map<String, Object>) body.get("data");
                    System.out.println("[UserServiceClient] data 필드: " + data);
                    if (data != null) {
                        try {
                            Object idObj = data.get("id");
                            System.out.println("[UserServiceClient] id 값: " + idObj + " (타입: " + (idObj != null ? idObj.getClass() : "null") + ")");
                            
                            Long userId = null;
                            if (idObj instanceof Number) {
                                userId = ((Number) idObj).longValue();
                            } else if (idObj instanceof Long) {
                                userId = (Long) idObj;
                            }
                            
                            if (userId == null) {
                                System.err.println("[UserServiceClient] ID를 파싱할 수 없습니다. idObj: " + idObj);
                                return null;
                            }
                            
                            UserResponse userResponse = UserResponse.builder()
                                .id(userId)
                                .name((String) data.get("name"))
                                .email((String) data.get("email"))
                                .nickname((String) data.get("nickname"))
                                .provider((String) data.get("provider"))
                                .providerId((String) data.get("providerId"))
                                .build();
                            System.out.println("[UserServiceClient] 사용자 저장 성공: ID=" + userResponse.getId() + ", email=" + userResponse.getEmail());
                            return userResponse;
                        } catch (Exception parseException) {
                            System.err.println("[UserServiceClient] UserResponse 빌드 중 예외 발생: " + parseException.getMessage());
                            parseException.printStackTrace();
                            return null;
                        }
                    } else {
                        System.err.println("[UserServiceClient] 사용자 저장 실패 - data 필드가 null입니다. body: " + body);
                    }
                } else {
                    System.err.println("[UserServiceClient] 사용자 저장 실패 - 응답 코드: " + code + ", 메시지: " + body.get("message") + ", 전체 body: " + body);
                }
            } else {
                System.err.println("[UserServiceClient] 사용자 저장 실패 - 응답 body가 null입니다. HTTP 상태: " + response.getStatusCode());
            }
            return null;
        } catch (HttpServerErrorException e) {
            // 500 에러 처리 (중복 키 에러 포함)
            System.err.println("[UserServiceClient] 사용자 저장 서버 에러 발생!");
            System.err.println("[UserServiceClient] HTTP 상태 코드: " + e.getStatusCode());
            System.err.println("[UserServiceClient] 응답 본문: " + e.getResponseBodyAsString());
            System.err.println("[UserServiceClient] 응답 헤더: " + e.getResponseHeaders());
            
            // 중복 키 에러인 경우 이미 존재하는 사용자를 다시 조회
            String errorBody = e.getResponseBodyAsString();
            if (errorBody != null && (errorBody.contains("duplicate key") || errorBody.contains("already exists") || errorBody.contains("ukruj7llynj9miho19bgmskwipt") || errorBody.contains("DataIntegrityViolationException"))) {
                System.out.println("[UserServiceClient] 중복 키 에러 감지, 사용자 재조회 시도: " + email + ", " + provider);
                return findByEmailAndProvider(email, provider);
            }
            
            e.printStackTrace();
            return null;
        } catch (HttpClientErrorException e) {
            // 4xx 에러 처리 (409 Conflict 포함)
            System.err.println("[UserServiceClient] 사용자 저장 클라이언트 에러 발생!");
            System.err.println("[UserServiceClient] HTTP 상태 코드: " + e.getStatusCode());
            System.err.println("[UserServiceClient] 응답 본문: " + e.getResponseBodyAsString());
            System.err.println("[UserServiceClient] 응답 헤더: " + e.getResponseHeaders());
            
            // 409 Conflict인 경우 중복 키 에러로 간주하고 재조회
            if (e.getStatusCode().value() == 409) {
                System.out.println("[UserServiceClient] 409 Conflict 감지, 사용자 재조회 시도: " + email + ", " + provider);
                return findByEmailAndProvider(email, provider);
            }
            
            e.printStackTrace();
            return null;
        } catch (org.springframework.web.client.ResourceAccessException e) {
            // 네트워크 연결 에러
            System.err.println("[UserServiceClient] 네트워크 연결 에러 발생!");
            System.err.println("[UserServiceClient] 에러 메시지: " + e.getMessage());
            System.err.println("[UserServiceClient] 요청 URL: " + url);
            e.printStackTrace();
            return null;
        } catch (Exception e) {
            System.err.println("[UserServiceClient] 사용자 저장 중 예외 발생!");
            System.err.println("[UserServiceClient] 예외 타입: " + e.getClass().getName());
            System.err.println("[UserServiceClient] 예외 메시지: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }
}

