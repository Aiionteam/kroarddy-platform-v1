package site.aiion.api.services.groupchat;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

import site.aiion.api.services.oauth.util.JwtTokenProvider;
import site.aiion.api.services.user.UserRepository;
import site.aiion.api.services.user.User;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/groupchat")
@org.springframework.context.annotation.Scope("singleton")
@Tag(name = "GroupChat SSE", description = "단체 채팅방 실시간 스트리밍")
public class GroupChatSSEController {

    private final GroupChatRepository groupChatRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;
    private final ScheduledExecutorService executor = Executors.newScheduledThreadPool(10);
    private final ConcurrentHashMap<String, SseEmitter> emitters = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicLong> lastMessageIds = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> emitterRoomTypes = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "실시간 메시지 스트림 (SSE, 방별)", description = "JWT 필요(token 쿼리 파라미터). 지정 등급 방의 새 메시지를 실시간으로 받습니다. 명예도 부족 시 403.")
    public SseEmitter streamMessages(
            @RequestParam(value = "roomType", defaultValue = "SILVER") String roomType,
            @RequestParam(value = "lastId", defaultValue = "0") Long lastId,
            @RequestParam(value = "token", required = false) String tokenParam,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            HttpServletResponse response) {
        String token = tokenParam;
        if (token == null || token.isBlank()) {
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                token = authHeader.substring(7);
            }
        }
        if (token == null || token.isBlank() || !jwtTokenProvider.validateToken(token)) {
            try {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.getWriter().write("{\"code\":401,\"message\":\"인증이 필요합니다.\"}");
            } catch (Exception ignored) {}
            return null;
        }
        Long userId;
        try {
            userId = Long.parseLong(jwtTokenProvider.getUserIdFromToken(token));
        } catch (NumberFormatException e) {
            try {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.getWriter().write("{\"code\":401,\"message\":\"유효하지 않은 토큰입니다.\"}");
            } catch (Exception ignored) {}
            return null;
        }
        int userHonor = userRepository.findById(userId)
                .map(u -> u.getHonor() != null ? u.getHonor() : 0)
                .orElse(0);
        String rt = (roomType != null && !roomType.isBlank()) ? roomType.toUpperCase() : "SILVER";
        ChatRoomType room;
        try {
            room = ChatRoomType.valueOf(rt);
        } catch (Exception e) {
            room = ChatRoomType.SILVER;
        }
        if (!room.canAccess(userHonor)) {
            try {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.getWriter().write("{\"code\":403,\"message\":\"명예도가 부족하여 해당 방에 입장할 수 없습니다.\"}");
            } catch (Exception ignored) {}
            return null;
        }
        final String roomTypeNorm = room.name();

        String allowOrigin = System.getenv("FRONTEND_URL");
        if (allowOrigin == null || allowOrigin.isEmpty()) {
            allowOrigin = "http://localhost:3000";
        }
        response.setHeader("Access-Control-Allow-Origin", allowOrigin.trim().replaceFirst("/$", ""));
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Cache-Control");
        response.setHeader("Cache-Control", "no-cache, no-transform");
        response.setHeader("Connection", "keep-alive");
        response.setHeader("X-Accel-Buffering", "no");

        log.info("========== SSE 연결 요청 ========== roomType={}, lastId={}", roomTypeNorm, lastId);

        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        String emitterId = String.valueOf(System.currentTimeMillis());
        emitters.put(emitterId, emitter);
        lastMessageIds.put(emitterId, new AtomicLong(lastId));
        emitterRoomTypes.put(emitterId, roomTypeNorm);

        log.info("SSE Emitter 생성: emitterId={}, roomType={}, 현재 연결 수={}", emitterId, roomTypeNorm, emitters.size());

        Runnable cleanup = () -> {
            ScheduledFuture<?> future = scheduledTasks.remove(emitterId);
            if (future != null) future.cancel(false);
            emitters.remove(emitterId);
            lastMessageIds.remove(emitterId);
            emitterRoomTypes.remove(emitterId);
        };

        emitter.onCompletion(() -> {
            log.info("SSE 연결 종료: emitterId={}", emitterId);
            cleanup.run();
        });

        emitter.onTimeout(() -> {
            log.info("SSE 연결 타임아웃: emitterId={}", emitterId);
            cleanup.run();
        });

        emitter.onError((ex) -> {
            log.debug("SSE 연결 끊김: emitterId={} (클라이언트 종료)", emitterId);
            cleanup.run();
        });

        try {
            // 연결 확립을 위한 초기 이벤트 전송 (필수!)
            log.info("초기 연결 이벤트 전송 중...");
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data("SSE connection established"));
            log.info("✓ 초기 연결 이벤트 전송 성공");
            
            sendInitialMessages(emitter, roomTypeNorm, lastId);
        } catch (IOException e) {
            log.error("초기 이벤트 전송 실패: emitterId={}", emitterId, e);
            emitters.remove(emitterId);
            lastMessageIds.remove(emitterId);
            emitterRoomTypes.remove(emitterId);
            emitter.completeWithError(e);
            return emitter;
        }

        // DB 폴링 없음. 새 메시지는 broadcastMessage() 호출 시에만 푸시됨 (실시간).
        // 연결 유지용 keep-alive만 30초마다 전송 (DB 조회 없음).
        ScheduledFuture<?> future = executor.scheduleAtFixedRate(() -> {
            try {
                if (!emitters.containsKey(emitterId)) {
                    return;
                }
                try {
                    emitter.send(SseEmitter.event()
                            .name("ping")
                            .comment("keep-alive"));
                } catch (Exception e) {
                    log.debug("SSE keep-alive 실패(연결 끊김): emitterId={}", emitterId);
                    ScheduledFuture<?> f = scheduledTasks.remove(emitterId);
                    if (f != null) f.cancel(false);
                    emitters.remove(emitterId);
                    lastMessageIds.remove(emitterId);
                    emitterRoomTypes.remove(emitterId);
                }
            } catch (Exception e) {
                log.warn("SSE keep-alive 오류: emitterId={}", emitterId, e);
                ScheduledFuture<?> f = scheduledTasks.remove(emitterId);
                if (f != null) f.cancel(false);
                emitters.remove(emitterId);
                lastMessageIds.remove(emitterId);
                emitterRoomTypes.remove(emitterId);
            }
        }, 30, 30, TimeUnit.SECONDS);

        scheduledTasks.put(emitterId, future);
        return emitter;
    }

    private void sendInitialMessages(SseEmitter emitter, String roomType, Long lastId) {
        try {
            List<GroupChatModel> recentMessages = getMessagesAfterId(roomType, lastId);
            log.info("초기 메시지 개수: roomType={}, count={}", roomType, recentMessages.size());
            if (recentMessages.isEmpty()) return;
            for (GroupChatModel msg : recentMessages) {
                emitter.send(SseEmitter.event()
                        .id(String.valueOf(msg.getId()))
                        .name("message")
                        .data(msg));
            }
        } catch (Exception e) {
            log.error("초기 메시지 전송 오류", e);
        }
    }

    private static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    private static final int RETENTION_HOURS = 24;

    private List<GroupChatModel> getMessagesAfterId(String roomType, Long lastId) {
        try {
            if (lastId == null || lastId < 0) lastId = 0L;
            ChatRoomType rt = ChatRoomType.SILVER;
            try {
                rt = ChatRoomType.valueOf(roomType != null ? roomType.toUpperCase() : "SILVER");
            } catch (Exception ignored) {}
            LocalDateTime cutoff = LocalDateTime.now(ZONE).minusHours(RETENTION_HOURS);
            List<GroupChat> entities = groupChatRepository.findByIdGreaterThanAndRoomTypeAndCreatedAtAfterOrderByCreatedAtAsc(lastId, rt, cutoff);
            return entities.stream().map(this::entityToModel).collect(Collectors.toList());
        } catch (Exception e) {
            log.error("메시지 조회 오류", e);
            return List.of();
        }
    }

    private GroupChatModel entityToModel(GroupChat entity) {
        if (entity == null) return null;
        return GroupChatModel.builder()
                .id(entity.getId())
                .roomType(entity.getRoomType() != null ? entity.getRoomType().name() : "SILVER")
                .userId(entity.getUserId())
                .username(entity.getUsername())
                .message(entity.getMessage())
                .lookingForBuddy(Boolean.TRUE.equals(entity.getLookingForBuddy()))
                .createdAt(entity.getCreatedAt())
                .build();
    }
    
    /** 같은 방(roomType)에 연결된 클라이언트에게만 새 메시지 브로드캐스트 */
    public void broadcastMessage(GroupChatModel message) {
        if (message == null || message.getId() == null) {
            log.warn("브로드캐스트 실패: 메시지가 null이거나 ID가 없음");
            return;
        }
        String msgRoom = message.getRoomType() != null ? message.getRoomType().toUpperCase() : "SILVER";
        if (emitters.isEmpty()) return;
        List<String> toRemove = new java.util.ArrayList<>();
        int successCount = 0;
        for (java.util.Map.Entry<String, SseEmitter> entry : emitters.entrySet()) {
            String emitterId = entry.getKey();
            if (!msgRoom.equals(emitterRoomTypes.get(emitterId))) continue;
            SseEmitter emitter = entry.getValue();
            AtomicLong currentLastId = lastMessageIds.get(emitterId);
            try {
                if (currentLastId != null && message.getId() > currentLastId.get()) {
                    currentLastId.set(message.getId());
                    emitter.send(SseEmitter.event()
                            .id(String.valueOf(message.getId()))
                            .name("message")
                            .data(message));
                    successCount++;
                }
            } catch (IOException e) {
                log.debug("SSE 브로드캐스트 오류: emitterId={}", emitterId, e);
                toRemove.add(emitterId);
            }
        }
        for (String emitterId : toRemove) {
            emitters.remove(emitterId);
            lastMessageIds.remove(emitterId);
            emitterRoomTypes.remove(emitterId);
        }
    }
}

