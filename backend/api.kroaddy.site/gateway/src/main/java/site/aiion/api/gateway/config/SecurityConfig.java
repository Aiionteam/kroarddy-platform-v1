package site.aiion.api.gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Spring Security 설정
 * 기존 OAuth 컨트롤러와 통합하여 보안 기능 강화
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * SecurityFilterChain 설정
     * - CSRF 보호 활성화 (API는 JWT 기반이므로 세션 기반 CSRF는 선택적)
     * - 세션 정책: STATELESS (JWT 기반 인증)
     * - 보안 헤더 추가
     * - OAuth 엔드포인트는 허용 (기존 컨트롤러 사용)
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // CSRF 설정
            // API는 JWT 기반이므로 세션 기반 CSRF는 비활성화
            // 하지만 OAuth 콜백은 세션을 사용할 수 있으므로 선택적으로 활성화 가능
            .csrf(csrf -> csrf
                .ignoringRequestMatchers(
                    "/api/**",  // API 엔드포인트는 JWT 기반
                    "/docs/**", // Swagger UI
                    "/v3/api-docs/**" // Swagger API 문서
                )
            )
            
            // 세션 정책: STATELESS (JWT 기반 인증)
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            
            // 요청 인가 설정
            // 주의: JWT 토큰 검증은 컨트롤러 레벨에서 처리하므로
            // Spring Security는 모든 API 엔드포인트를 permitAll()로 설정
            // 실제 인증은 각 컨트롤러에서 JwtTokenUtil/JwtTokenProvider로 검증
            .authorizeHttpRequests(auth -> auth
                // 모든 API 엔드포인트 허용 (JWT 검증은 컨트롤러 레벨에서 처리)
                .requestMatchers("/api/**").permitAll()
                
                // Swagger UI 및 문서
                .requestMatchers(
                    "/docs/**",                   // Swagger UI
                    "/v3/api-docs/**"             // Swagger API 문서
                ).permitAll()
                
                // Actuator 엔드포인트
                .requestMatchers(
                    "/actuator/health",           // Health check
                    "/actuator/info"              // Info endpoint
                ).permitAll()
                
                // 기타 요청은 허용
                .anyRequest().permitAll()
            )
            
            // 보안 헤더 설정
            .headers(headers -> headers
                .frameOptions(frame -> frame.deny())  // Clickjacking 방지
                .contentTypeOptions(contentType -> {})  // MIME 타입 스니핑 방지 (X-Content-Type-Options: nosniff)
                .httpStrictTransportSecurity(hsts -> hsts
                    .maxAgeInSeconds(31536000)  // 1년
                    .includeSubDomains(true)  // 대소문자 주의: includeSubDomains
                )
                .referrerPolicy(referrer -> referrer
                    .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
                )
            )
            
            // 기본 인증 비활성화 (JWT 기반 인증 사용)
            .httpBasic(AbstractHttpConfigurer::disable)
            
            // 폼 로그인 비활성화 (OAuth만 사용)
            .formLogin(AbstractHttpConfigurer::disable)
            
            // CORS 활성화 (백엔드에서만 처리, Nginx는 프록시만)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()));
        
        return http.build();
    }
    
    /**
     * CORS 설정 - 명확한 단일 Origin만 허용
     * Nginx는 리버스 프록시 역할만 하고, CORS는 백엔드에서만 처리
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        
        // 허용 Origin: FRONTEND_URL(www.tourstory.site) + 로컬 개발 (www.hohyun.site는 참고용, 미연결)
        String frontendUrl = System.getenv("FRONTEND_URL");
        List<String> origins = new ArrayList<>(Arrays.asList(
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8080",
            "http://127.0.0.1:8080"
        ));
        if (frontendUrl != null && !frontendUrl.isEmpty()) {
            origins.add(frontendUrl.trim());
            if (frontendUrl.endsWith("/")) {
                origins.add(frontendUrl.substring(0, frontendUrl.length() - 1));
            }
        }
        config.setAllowedOrigins(origins);
        
        // 허용할 HTTP 메서드
        config.setAllowedMethods(Arrays.asList(
            "GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"
        ));
        
        // 허용할 헤더 (모든 헤더 허용)
        config.setAllowedHeaders(List.of("*"));
        
        // 인증 정보 포함 허용 (쿠키, Authorization 헤더 등)
        config.setAllowCredentials(true);
        
        // preflight 요청 캐시 시간 (1시간)
        config.setMaxAge(3600L);
        
        // 노출할 헤더
        config.setExposedHeaders(Arrays.asList(
            "Authorization",
            "Content-Type",
            "X-Requested-With",
            "Accept",
            "Origin"
        ));
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        
        return source;
    }
}

