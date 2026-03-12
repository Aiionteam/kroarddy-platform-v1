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

    @PostMapping
    public Messenger send(
            @RequestBody WhisperModel model,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return Messenger.builder().code(401).message("인증이 필요합니다.").build();
        }
        String token = authHeader.substring(7);
        if (!jwtTokenProvider.validateToken(token)) {
            return Messenger.builder().code(401).message("유효하지 않은 토큰입니다.").build();
        }
        Long fromUserId;
        try {
            fromUserId = Long.parseLong(jwtTokenProvider.getUserIdFromToken(token));
        } catch (NumberFormatException e) {
            return Messenger.builder().code(401).message("토큰에서 사용자 ID를 추출할 수 없습니다.").build();
        }
        return whisperService.send(fromUserId, model);
    }

    @GetMapping("/inbox")
    public Messenger inbox(
            @RequestParam(value = "size", defaultValue = "50") int size,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return Messenger.builder().code(401).message("인증이 필요합니다.").build();
        }
        String token = authHeader.substring(7);
        if (!jwtTokenProvider.validateToken(token)) {
            return Messenger.builder().code(401).message("유효하지 않은 토큰입니다.").build();
        }
        Long userId;
        try {
            userId = Long.parseLong(jwtTokenProvider.getUserIdFromToken(token));
        } catch (NumberFormatException e) {
            return Messenger.builder().code(401).message("토큰에서 사용자 ID를 추출할 수 없습니다.").build();
        }
        return whisperService.findInbox(userId, PageRequest.of(0, size));
    }

    @GetMapping("/sent")
    public Messenger sent(
            @RequestParam(value = "size", defaultValue = "50") int size,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return Messenger.builder().code(401).message("인증이 필요합니다.").build();
        }
        String token = authHeader.substring(7);
        if (!jwtTokenProvider.validateToken(token)) {
            return Messenger.builder().code(401).message("유효하지 않은 토큰입니다.").build();
        }
        Long userId;
        try {
            userId = Long.parseLong(jwtTokenProvider.getUserIdFromToken(token));
        } catch (NumberFormatException e) {
            return Messenger.builder().code(401).message("토큰에서 사용자 ID를 추출할 수 없습니다.").build();
        }
        return whisperService.findSent(userId, PageRequest.of(0, size));
    }
}
