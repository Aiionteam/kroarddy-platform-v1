package site.aiion.api.services.user;

import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import site.aiion.api.services.oauth.util.JwtTokenProvider;
import site.aiion.api.services.user.common.domain.Messenger;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/users/block")
public class UserBlockController {

    private final UserBlockRepository blockRepository;
    private final UserRepository userRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final JwtTokenProvider jwtTokenProvider;

    private Long extractUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String token = authHeader.substring(7);
        if (!jwtTokenProvider.validateToken(token)) return null;
        try {
            return Long.parseLong(jwtTokenProvider.getUserIdFromToken(token));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 차단 목록 조회 */
    @GetMapping
    public Messenger getBlockList(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long me = extractUserId(authHeader);
        if (me == null) return Messenger.builder().code(401).message("인증이 필요합니다.").build();

        List<UserBlock> blocks = blockRepository.findByBlockerIdOrderByCreatedAtDesc(me);
        List<UserModel> data = blocks.stream().map(b -> {
            User u = userRepository.findById(b.getBlockedId()).orElse(null);
            return UserModel.builder()
                    .id(b.getBlockedId())
                    .name(u != null ? u.getName() : null)
                    .nickname(u != null ? u.getNickname() : null)
                    .build();
        }).collect(Collectors.toList());
        return Messenger.builder().code(200).message("차단 목록").data(data).build();
    }

    /** 차단 */
    @Transactional
    @PostMapping("/{targetId}")
    public Messenger block(
            @PathVariable Long targetId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long me = extractUserId(authHeader);
        if (me == null) return Messenger.builder().code(401).message("인증이 필요합니다.").build();
        if (me.equals(targetId)) return Messenger.builder().code(400).message("자기 자신은 차단할 수 없습니다.").build();
        if (blockRepository.existsByBlockerIdAndBlockedId(me, targetId)) {
            return Messenger.builder().code(409).message("이미 차단된 사용자입니다.").build();
        }
        blockRepository.save(UserBlock.builder().blockerId(me).blockedId(targetId).build());
        // 차단 시 친구 관계도 함께 제거
        friendRequestRepository.deleteBetween(me, targetId);
        return Messenger.builder().code(200).message("차단했습니다.").build();
    }

    /** 차단 해제 */
    @DeleteMapping("/{targetId}")
    public Messenger unblock(
            @PathVariable Long targetId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long me = extractUserId(authHeader);
        if (me == null) return Messenger.builder().code(401).message("인증이 필요합니다.").build();
        blockRepository.findByBlockerIdAndBlockedId(me, targetId)
                .ifPresent(blockRepository::delete);
        return Messenger.builder().code(200).message("차단을 해제했습니다.").build();
    }

    /** 특정 유저 차단 여부 확인 */
    @GetMapping("/{targetId}")
    public Messenger isBlocked(
            @PathVariable Long targetId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long me = extractUserId(authHeader);
        if (me == null) return Messenger.builder().code(401).message("인증이 필요합니다.").build();
        boolean blocked = blockRepository.existsByBlockerIdAndBlockedId(me, targetId);
        return Messenger.builder().code(200).message(blocked ? "차단됨" : "차단 안됨").data(blocked).build();
    }
}
