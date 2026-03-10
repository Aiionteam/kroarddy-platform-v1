package site.aiion.api.services.groupchat;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import site.aiion.api.services.user.common.domain.Messenger;
import site.aiion.api.services.oauth.util.JwtTokenProvider;
import site.aiion.api.services.user.UserRepository;
import site.aiion.api.services.user.User;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/groupchat")
@Tag(name = "GroupChat", description = "단체 채팅방 기능")
public class GroupChatController {

    private static final String[] ROOM_LABELS = {"실버", "골드", "플래티넘", "다이아"};

    private final GroupChatService groupChatService;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;

    /** JWT에서 userId 추출, 없으면 null */
    private Long getUserIdFromAuth(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String token = authHeader.substring(7);
        if (token.isEmpty() || !jwtTokenProvider.validateToken(token)) return null;
        try {
            return Long.parseLong(jwtTokenProvider.getUserIdFromToken(token));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 사용자 명예도 조회 (없으면 0) */
    private int getUserHonor(Long userId) {
        if (userId == null) return 0;
        return userRepository.findById(userId)
                .map(u -> u.getHonor() != null ? u.getHonor() : 0)
                .orElse(0);
    }

    @GetMapping("/rooms")
    @Operation(summary = "대화방 목록 (접근 가능 여부 포함)", description = "JWT 필요. 명예도에 따라 입장 가능한 방 목록을 반환합니다. 상위 티어는 하위 방 접근 가능.")
    public Messenger getRooms(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = getUserIdFromAuth(authHeader);
        if (userId == null) {
            return Messenger.builder().code(401).message("인증이 필요합니다.").build();
        }
        int userHonor = getUserHonor(userId);
        ChatRoomType[] types = ChatRoomType.values();
        List<ChatRoomInfo> rooms = new ArrayList<>();
        for (int i = 0; i < types.length; i++) {
            ChatRoomType rt = types[i];
            rooms.add(ChatRoomInfo.builder()
                    .roomType(rt.name())
                    .label(ROOM_LABELS[i])
                    .minHonor(rt.getMinHonor())
                    .accessible(rt.canAccess(userHonor))
                    .build());
        }
        return Messenger.builder().code(200).message("OK").data(rooms).build();
    }

    @PostMapping
    @Operation(summary = "메시지 전송", description = "단체 채팅방에 메시지를 전송합니다. 인증된 사용자만 가능합니다.")
    public Messenger sendMessage(
            @RequestBody GroupChatModel groupChatModel,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        
        // JWT 토큰에서 userId 추출 및 검증
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return Messenger.builder()
                    .code(401)
                    .message("인증 토큰이 필요합니다. 로그인 후 메시지를 보낼 수 있습니다.")
                    .build();
        }

        String token = authHeader.substring(7);
        if (token.isEmpty() || !jwtTokenProvider.validateToken(token)) {
            return Messenger.builder()
                    .code(401)
                    .message("유효하지 않은 토큰입니다.")
                    .build();
        }

        Long tokenUserId;
        try {
            tokenUserId = Long.parseLong(jwtTokenProvider.getUserIdFromToken(token));
        } catch (NumberFormatException e) {
            return Messenger.builder()
                    .code(401)
                    .message("토큰에서 사용자 ID를 추출할 수 없습니다.")
                    .build();
        }

        // 토큰의 userId로 설정 (클라이언트에서 보낸 userId는 무시)
        groupChatModel.setUserId(tokenUserId);

        Optional<User> userOpt = userRepository.findById(tokenUserId);
        int userHonor = 0;
        String username = "사용자 " + tokenUserId;
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            username = user.getNickname() != null && !user.getNickname().isEmpty()
                    ? user.getNickname()
                    : (user.getName() != null ? user.getName() : "사용자 " + tokenUserId);
            userHonor = user.getHonor() != null ? user.getHonor() : 0;
        }
        groupChatModel.setUsername(username);

        // 방 타입: 클라이언트가 보낸 roomType이 있으면 접근 가능할 때만 사용, 아니면 사용자 등급 방
        String requestedRoom = (groupChatModel.getRoomType() != null && !groupChatModel.getRoomType().isBlank())
                ? groupChatModel.getRoomType().toUpperCase() : null;
        ChatRoomType roomType;
        if (requestedRoom != null) {
            try {
                ChatRoomType rt = ChatRoomType.valueOf(requestedRoom);
                if (!rt.canAccess(userHonor)) {
                    return Messenger.builder()
                            .code(403)
                            .message("명예도가 부족하여 해당 방에 입장할 수 없습니다. 필요 명예도: " + rt.getMinHonor() + ", 현재: " + userHonor)
                            .build();
                }
                roomType = rt;
            } catch (IllegalArgumentException e) {
                roomType = ChatRoomType.fromHonor(userHonor);
            }
        } else {
            roomType = ChatRoomType.fromHonor(userHonor);
        }
        groupChatModel.setRoomType(roomType.name());

        if (groupChatModel.getLookingForBuddy() == null) {
            groupChatModel.setLookingForBuddy(false);
        }
        return groupChatService.save(groupChatModel);
    }

    @GetMapping
    @Operation(summary = "메시지 목록 조회 (Public)", description = "단체 채팅방 메시지 목록을 조회합니다. 인증 불필요 (모두 조회 가능).")
    public Messenger getMessages(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "50") int size) {
        
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return groupChatService.findAll(pageable);
    }

    @GetMapping("/recent")
    @Operation(summary = "최근 메시지 조회 (방별)", description = "JWT 필요. 지정한 등급 방의 최근 N개 메시지. 명예도가 부족하면 403.")
    public Messenger getRecentMessages(
            @RequestParam(value = "roomType", defaultValue = "SILVER") String roomType,
            @RequestParam(value = "limit", defaultValue = "50") int limit,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = getUserIdFromAuth(authHeader);
        if (userId == null) {
            return Messenger.builder().code(401).message("인증이 필요합니다.").build();
        }
        int userHonor = getUserHonor(userId);
        String rt = (roomType != null && !roomType.isBlank()) ? roomType.toUpperCase() : "SILVER";
        ChatRoomType room;
        try {
            room = ChatRoomType.valueOf(rt);
        } catch (IllegalArgumentException e) {
            room = ChatRoomType.SILVER;
        }
        if (!room.canAccess(userHonor)) {
            return Messenger.builder()
                    .code(403)
                    .message("명예도가 부족하여 해당 방을 볼 수 없습니다. 필요 명예도: " + room.getMinHonor() + ", 현재: " + userHonor)
                    .build();
        }
        return groupChatService.findRecentMessages(room.name(), limit);
    }

    @DeleteMapping("/all")
    @Operation(summary = "모든 메시지 삭제", description = "단체 채팅방의 모든 메시지를 삭제합니다. userId 1만 권한이 있습니다.")
    public Messenger deleteAllMessages(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        
        // JWT 토큰에서 userId 추출 및 검증
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return Messenger.builder()
                    .code(401)
                    .message("인증 토큰이 필요합니다.")
                    .build();
        }

        String token = authHeader.substring(7);
        if (token.isEmpty() || !jwtTokenProvider.validateToken(token)) {
            return Messenger.builder()
                    .code(401)
                    .message("유효하지 않은 토큰입니다.")
                    .build();
        }

        Long tokenUserId;
        try {
            tokenUserId = Long.parseLong(jwtTokenProvider.getUserIdFromToken(token));
        } catch (NumberFormatException e) {
            return Messenger.builder()
                    .code(401)
                    .message("토큰에서 사용자 ID를 추출할 수 없습니다.")
                    .build();
        }

        // userId 1만 권한 허용
        if (!tokenUserId.equals(1L)) {
            return Messenger.builder()
                    .code(403)
                    .message("메시지 삭제 권한이 없습니다. (userId 1만 가능)")
                    .build();
        }

        return groupChatService.deleteAll();
    }
}

