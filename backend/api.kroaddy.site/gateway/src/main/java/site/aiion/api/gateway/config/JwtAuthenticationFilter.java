package site.aiion.api.gateway.config;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import site.aiion.api.services.oauth.token.TokenService;
import site.aiion.api.services.oauth.util.JwtTokenProvider;

import java.io.IOException;
import java.util.List;

/**
 * JWT 중앙 인증 필터
 *
 * 토큰 추출 우선순위:
 *   1. HttpOnly 쿠키 access_token (보안 최우선)
 *   2. Authorization: Bearer 헤더 (SSE / 모바일 딥링크 하위호환)
 *   3. ?token 쿼리 파라미터 (레거시 SSE)
 *
 * 유효한 토큰이 있으면 Redis REVOKED 마커를 확인한 뒤 SecurityContext에 설정합니다.
 * 토큰이 없거나 유효하지 않아도 요청을 차단하지 않습니다 (Spring Security는 permitAll).
 * 인증이 필요한 엔드포인트는 컨트롤러/서비스에서 SecurityContext를 통해 처리합니다.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final TokenService tokenService;

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider, TokenService tokenService) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.tokenService = tokenService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String token = extractToken(request);

        if (StringUtils.hasText(token)) {
            try {
                if (jwtTokenProvider.validateToken(token)) {
                    Claims claims = jwtTokenProvider.getAllClaimsFromToken(token);
                    String userId   = claims.getSubject();
                    String provider = (String) claims.get("provider");

                    // REVOKED 마커 확인 (로그아웃 또는 강제 폐기된 세션)
                    if (provider != null && tokenService.isRevoked(provider, userId)) {
                        SecurityContextHolder.clearContext();
                        filterChain.doFilter(request, response);
                        return;
                    }

                    var auth = new UsernamePasswordAuthenticationToken(
                            userId, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))
                    );
                    auth.setDetails(claims);
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception e) {
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * 쿠키 → Bearer 헤더 → 쿼리 파라미터 순으로 토큰을 추출합니다.
     */
    private String extractToken(HttpServletRequest request) {
        // 1. HttpOnly 쿠키 access_token 우선
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("access_token".equals(cookie.getName())) {
                    String val = cookie.getValue();
                    if (StringUtils.hasText(val)) return val;
                }
            }
        }
        // 2. Authorization: Bearer 헤더 (SSE / 모바일)
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        // 3. ?token 쿼리 파라미터 (레거시 SSE 폴백)
        String queryToken = request.getParameter("token");
        if (StringUtils.hasText(queryToken)) {
            return queryToken;
        }
        return null;
    }
}
