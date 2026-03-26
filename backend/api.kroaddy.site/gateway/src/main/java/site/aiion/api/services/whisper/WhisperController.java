package site.aiion.api.services.whisper;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;
import site.aiion.api.services.oauth.util.JwtTokenProvider;
import site.aiion.api.services.user.common.domain.Messenger;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/whisper")
public class WhisperController {

    private final WhisperService whisperService;
    private final JwtTokenProvider jwtTokenProvider;

    private Long extractUserId(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtTokenProvider.validateToken(token)) {
                try {
                    return Long.parseLong(jwtTokenProvider.getUserIdFromToken(token));
                } catch (NumberFormatException e) {
                    return null;
                }
            }
        }
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

    private Messenger unauthorized() {
        return Messenger.builder().code(401).message("인증이 필요합니다.").build();
    }

    @PostMapping
    public Messenger send(
            @RequestBody WhisperModel model,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = extractUserId(authHeader);
        if (userId == null) return unauthorized();
        return whisperService.send(userId, model);
    }

    @GetMapping("/inbox")
    public Messenger inbox(
            @RequestParam(value = "size", defaultValue = "50") int size,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = extractUserId(authHeader);
        if (userId == null) return unauthorized();
        return whisperService.findInbox(userId, PageRequest.of(0, size));
    }

    @GetMapping("/sent")
    public Messenger sent(
            @RequestParam(value = "size", defaultValue = "50") int size,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = extractUserId(authHeader);
        if (userId == null) return unauthorized();
        return whisperService.findSent(userId, PageRequest.of(0, size));
    }

    /** 대화 목록 (SMS 방식 - 상대방별 최신 메시지 요약) */
    @GetMapping("/conversations")
    public Messenger conversations(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = extractUserId(authHeader);
        if (userId == null) return unauthorized();
        return whisperService.findConversationList(userId);
    }

    /** 특정 상대방과의 대화 스레드 */
    @GetMapping("/conversation/{partnerId}")
    public Messenger conversation(
            @PathVariable Long partnerId,
            @RequestParam(value = "size", defaultValue = "100") int size,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = extractUserId(authHeader);
        if (userId == null) return unauthorized();
        return whisperService.findConversation(userId, partnerId, PageRequest.of(0, size));
    }

    /** 특정 상대방과의 대화 전체 삭제 */
    @DeleteMapping("/conversation/{partnerId}")
    public Messenger deleteConversation(
            @PathVariable Long partnerId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = extractUserId(authHeader);
        if (userId == null) return unauthorized();
        return whisperService.deleteConversation(userId, partnerId);
    }

    /** 특정 상대방의 메시지 읽음 처리 */
    @PatchMapping("/conversation/{partnerId}/read")
    public Messenger markRead(
            @PathVariable Long partnerId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = extractUserId(authHeader);
        if (userId == null) return unauthorized();
        return whisperService.markRead(userId, partnerId);
    }
}
