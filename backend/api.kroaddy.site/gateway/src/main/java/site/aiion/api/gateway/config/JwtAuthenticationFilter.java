package site.aiion.api.gateway.config;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
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
 * 모든 요청에서 Bearer 토큰을 추출하고,
 * 1) JWT 서명/만료 검증 (JwtTokenProvider) — 필수 검증
 * 2) Redis 가시성 확인 (soft check) — Redis에 토큰 없어도 통과, 로그만 남김
 *    명시적 로그아웃 시에만 "REVOKED:{userId}" 마커를 Redis에 저장하여 차단
 * 3) SecurityContextHolder에 인증 정보 주입 → 컨트롤러 수동 검증 불필요
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
                // 1. JWT 서명 & 만료 검증
                if (!jwtTokenProvider.validateToken(token)) {
                    sendUnauthorized(response, "유효하지 않은 토큰입니다.");
                    return;
                }

                Claims claims = jwtTokenProvider.getAllClaimsFromToken(token);
                String userId = claims.getSubject();
                String provider = claims.get("provider", String.class);

                // 2. Redis soft check — 명시적 REVOKED 마커만 차단
                //    토큰이 Redis에 없는 것은 정상 (Redis 재시작, URL 변경 등) → 통과
                //    "REVOKED:{provider}:{userId}" 마커가 있으면 로그아웃된 토큰 → 차단
                if (tokenService.isRedisAvailable()) {
                    String revokedKey = "REVOKED:" + provider + ":" + userId;
                    if (Boolean.TRUE.equals(tokenService.hasKey(revokedKey))) {
                        sendUnauthorized(response, "로그아웃된 사용자입니다.");
                        return;
                    }
                } else {
                    System.err.println("[JwtFilter] Redis 불가 - JWT 서명 검증만으로 진행 (degraded mode)");
                }

                // 3. SecurityContext에 인증 정보 주입 (claims을 details로 저장)
                var auth = new UsernamePasswordAuthenticationToken(
                        userId, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))
                );
                auth.setDetails(claims);
                SecurityContextHolder.getContext().setAuthentication(auth);

            } catch (Exception e) {
                SecurityContextHolder.clearContext();
                sendUnauthorized(response, "토큰 처리 중 오류가 발생했습니다.");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        // 1. Authorization: Bearer 헤더 (일반 API 요청)
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        // 2. ?token= 쿼리 파라미터 (SSE/EventSource - 브라우저가 커스텀 헤더 미지원)
        String queryToken = request.getParameter("token");
        if (StringUtils.hasText(queryToken)) {
            return queryToken;
        }
        return null;
    }

    private void sendUnauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(
                String.format("{\"success\":false,\"code\":401,\"message\":\"%s\"}", message)
        );
    }
}
