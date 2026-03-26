package site.aiion.api.services.user;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import site.aiion.api.services.oauth.util.JwtTokenProvider;
import site.aiion.api.services.user.common.domain.Messenger;

@RestController
@RequiredArgsConstructor
@RequestMapping(value = "/api/friends", produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8")
public class FriendController {

    private final FriendService friendService;
    private final JwtTokenProvider jwtTokenProvider;

    private Long getUserIdFromAuth(String authHeader) {
        // 1. Authorization: Bearer 헤더 (모바일 / SSE 레거시)
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (!jwtTokenProvider.validateToken(token)) return null;
            try {
                return Long.parseLong(jwtTokenProvider.getUserIdFromToken(token));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        // 2. HttpOnly 쿠키 인증 → JwtAuthenticationFilter가 SecurityContext에 설정한 값 사용
        var auth = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()
                && !"anonymousUser".equals(auth.getPrincipal())) {
            try {
                return Long.parseLong(auth.getName());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    @PostMapping("/request")
    public Messenger sendRequest(
            @RequestBody java.util.Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long fromUserId = getUserIdFromAuth(authHeader);
        if (fromUserId == null) {
            return Messenger.builder().code(401).message("인증이 필요합니다.").build();
        }
        Object toObj = body.get("toUserId");
        if (toObj == null) {
            return Messenger.builder().code(400).message("toUserId가 필요합니다.").build();
        }
        Long toUserId = toObj instanceof Number ? ((Number) toObj).longValue() : Long.parseLong(toObj.toString());
        return friendService.sendRequest(fromUserId, toUserId);
    }

    @GetMapping("/requests")
    public Messenger listPendingToMe(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long toUserId = getUserIdFromAuth(authHeader);
        if (toUserId == null) {
            return Messenger.builder().code(401).message("인증이 필요합니다.").build();
        }
        return friendService.listPendingToMe(toUserId);
    }

    @PostMapping("/accept")
    public Messenger accept(
            @RequestBody java.util.Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long toUserId = getUserIdFromAuth(authHeader);
        if (toUserId == null) {
            return Messenger.builder().code(401).message("인증이 필요합니다.").build();
        }
        Object fromObj = body.get("fromUserId");
        if (fromObj == null) {
            return Messenger.builder().code(400).message("fromUserId가 필요합니다.").build();
        }
        Long fromUserId = fromObj instanceof Number ? ((Number) fromObj).longValue() : Long.parseLong(fromObj.toString());
        return friendService.accept(toUserId, fromUserId);
    }

    @GetMapping
    public Messenger listFriends(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = getUserIdFromAuth(authHeader);
        if (userId == null) {
            return Messenger.builder().code(401).message("인증이 필요합니다.").build();
        }
        return friendService.listFriends(userId);
    }

    @DeleteMapping("/{targetId}")
    public Messenger removeFriend(
            @PathVariable Long targetId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = getUserIdFromAuth(authHeader);
        if (userId == null) {
            return Messenger.builder().code(401).message("인증이 필요합니다.").build();
        }
        return friendService.removeFriend(userId, targetId);
    }
}
