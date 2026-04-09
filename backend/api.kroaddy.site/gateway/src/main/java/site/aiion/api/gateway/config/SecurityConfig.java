package site.aiion.api.gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import site.aiion.api.services.oauth.token.TokenService;
import site.aiion.api.services.oauth.util.JwtTokenProvider;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Spring Security 설정
 * JWT 중앙 인증 필터를 통해 모든 보호 엔드포인트를 일괄 검증
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtTokenProvider jwtTokenProvider;
    private final TokenService tokenService;

    public SecurityConfig(JwtTokenProvider jwtTokenProvider, TokenService tokenService) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.tokenService = tokenService;
    }

    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter() {
        return new JwtAuthenticationFilter(jwtTokenProvider, tokenService);
    }

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
            // 플래너·가이드·축제 등 REST API는 모두 /api/** 로 노출 → 동일하게 CSRF 예외 (가이드는 /api/v1/guide/** 사용)
            .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**", "/docs/**", "/v3/api-docs/**"))

            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )

            // JWT 중앙 필터 — UsernamePasswordAuthenticationFilter 이전에 실행
            .addFilterBefore(jwtAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class)

            .authorizeHttpRequests(auth -> auth
                // ── Public: OAuth 인증 플로우 ─────────────────────────────────
                // Google Cloud Console / Kakao Developers 에 등록된 실제 redirect URI
                .requestMatchers("/oauth2/**").permitAll()

                // /api/* 하위의 OAuth 진입점 (auth-url, login 요청 등)
                .requestMatchers(
                    "/api/google/auth-url", "/api/google/callback",
                    "/api/google/login",    "/api/google/token"
                ).permitAll()
                .requestMatchers(
                    "/api/kakao/auth-url", "/api/kakao/callback",
                    "/api/kakao/token"
                ).permitAll()
                .requestMatchers("/api/naver/**").permitAll()

                // ── Public: 토큰 갱신 & 로그아웃 (쿠키 기반, Bearer 불필요) ──
                .requestMatchers("/api/auth/refresh", "/api/auth/logout").permitAll()

                // ── Public: 인프라 ──────────────────────────────────────────
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .requestMatchers("/docs/**", "/v3/api-docs/**").permitAll()

                // JWT 필터가 SecurityContext를 채우므로 Spring Security 자체 차단은 하지 않음
                // 인증 강제는 각 컨트롤러/서비스 레이어에서 처리
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
        
        // 허용 Origin: 코드에 명시적으로 관리 (환경변수 의존 제거)
        // FRONTEND_URL 환경변수가 구 도메인(tourstory.site)으로 설정된 경우에도 영향 없도록 고정 목록 사용
        List<String> origins = new ArrayList<>(Arrays.asList(
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
            "https://web.kroaddy.site",
            "https://www.kroaddy.site"
        ));
        // FRONTEND_URL이 추가 도메인으로 설정된 경우 허용 목록에 추가
        String frontendUrl = System.getenv("FRONTEND_URL");
        if (frontendUrl != null && !frontendUrl.isEmpty()) {
            String trimmed = frontendUrl.trim().replaceFirst("/$", "");
            if (!origins.contains(trimmed)) {
                origins.add(trimmed);
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

