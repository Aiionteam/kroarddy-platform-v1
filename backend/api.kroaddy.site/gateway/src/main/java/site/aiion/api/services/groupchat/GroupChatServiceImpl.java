package site.aiion.api.services.groupchat;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import site.aiion.api.services.user.common.domain.Messenger;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GroupChatServiceImpl implements GroupChatService {

    /** 메시지 보관 시간(시간). 이 시간이 지나면 조회에서 제외되고 스케줄러가 삭제함 */
    private static final int RETENTION_HOURS = 24;
    private static final ZoneId ZONE = ZoneId.of("Asia/Seoul");

    private final GroupChatRepository groupChatRepository;
    private final ApplicationContext applicationContext;

    private static LocalDateTime cutoffNow() {
        return LocalDateTime.now(ZONE).minusHours(RETENTION_HOURS);
    }
    
    // SSE 컨트롤러 가져오기 (순환 참조 방지)
    private GroupChatSSEController getSseController() {
        try {
            return applicationContext.getBean(GroupChatSSEController.class);
        } catch (Exception e) {
            log.debug("SSE 컨트롤러를 가져올 수 없음 (정상 - 초기화 중일 수 있음)");
            return null;
        }
    }

    private GroupChatModel entityToModel(GroupChat entity) {
        if (entity == null) {
            return null;
        }
        return GroupChatModel.builder()
                .id(entity.getId())
                .roomType(entity.getRoomType() != null ? entity.getRoomType().name() : "SILVER")
                .userId(entity.getUserId())
                .username(entity.getUsername())
                .message(entity.getMessage())
                .lookingForBuddy(entity.getLookingForBuddy() != null ? entity.getLookingForBuddy() : false)
                .createdAt(entity.getCreatedAt())
                .build();
    }

    private GroupChat modelToEntity(GroupChatModel model) {
        ChatRoomType roomType = ChatRoomType.SILVER;
        if (model.getRoomType() != null) {
            try {
                roomType = ChatRoomType.valueOf(model.getRoomType().toUpperCase());
            } catch (Exception ignored) {}
        }
        return GroupChat.builder()
                .roomType(roomType)
                .userId(model.getUserId())
                .username(model.getUsername())
                .message(model.getMessage())
                .lookingForBuddy(Boolean.TRUE.equals(model.getLookingForBuddy()))
                .build();
    }

    @Override
    @Transactional
    public Messenger save(GroupChatModel groupChatModel) {
        if (groupChatModel == null) {
            return Messenger.builder()
                    .code(400)
                    .message("메시지 정보가 필요합니다.")
                    .build();
        }

        if (groupChatModel.getUserId() == null) {
            return Messenger.builder()
                    .code(400)
                    .message("사용자 ID가 필요합니다.")
                    .build();
        }

        if (groupChatModel.getMessage() == null || groupChatModel.getMessage().trim().isEmpty()) {
            return Messenger.builder()
                    .code(400)
                    .message("메시지 내용이 필요합니다.")
                    .build();
        }

        try {
            GroupChat entity = modelToEntity(groupChatModel);
            GroupChat savedEntity = groupChatRepository.save(entity);
            GroupChatModel savedModel = entityToModel(savedEntity);

            log.info("그룹 채팅 메시지 저장 성공: userId={}, id={}", groupChatModel.getUserId(), savedEntity.getId());
            
            // SSE로 모든 연결된 클라이언트에게 즉시 브로드캐스트
            try {
                GroupChatSSEController sseController = getSseController();
                if (sseController != null) {
                    sseController.broadcastMessage(savedModel);
                    log.info("SSE 브로드캐스트 완료: messageId={}", savedEntity.getId());
                } else {
                    log.debug("SSE 컨트롤러를 가져올 수 없음 (정상 - 메시지는 저장됨)");
                }
            } catch (Exception e) {
                log.warn("SSE 브로드캐스트 실패 (메시지는 저장됨): messageId={}", savedEntity.getId(), e);
                // 브로드캐스트 실패해도 메시지 저장은 성공으로 처리
            }
            
            return Messenger.builder()
                    .code(200)
                    .message("메시지 전송 성공")
                    .data(savedModel)
                    .build();
        } catch (Exception e) {
            log.error("그룹 채팅 메시지 저장 중 오류 발생: userId={}", groupChatModel.getUserId(), e);
            return Messenger.builder()
                    .code(500)
                    .message("메시지 전송 중 오류가 발생했습니다: " + e.getMessage())
                    .build();
        }
    }

    @Override
    public Messenger findAll(Pageable pageable) {
        try {
            Page<GroupChat> page = groupChatRepository.findAllByOrderByCreatedAtDesc(pageable);
            List<GroupChatModel> messages = page.getContent().stream()
                    .map(this::entityToModel)
                    .collect(Collectors.toList());

            return Messenger.builder()
                    .code(200)
                    .message("메시지 목록 조회 성공")
                    .data(messages)
                    .build();
        } catch (Exception e) {
            log.error("그룹 채팅 메시지 목록 조회 중 오류 발생", e);
            return Messenger.builder()
                    .code(500)
                    .message("메시지 목록 조회 중 오류가 발생했습니다: " + e.getMessage())
                    .build();
        }
    }

    @Override
    public Messenger findRecentMessages(String roomType, int limit) {
        try {
            ChatRoomType rt = ChatRoomType.SILVER;
            if (roomType != null && !roomType.isBlank()) {
                try {
                    rt = ChatRoomType.valueOf(roomType.toUpperCase());
                } catch (Exception ignored) {}
            }
            LocalDateTime cutoff = cutoffNow();
            List<GroupChat> entities = groupChatRepository.findTop50ByRoomTypeAndCreatedAtAfterOrderByCreatedAtDesc(rt, cutoff);
            List<GroupChatModel> messages = entities.stream()
                    .limit(limit)
                    .map(this::entityToModel)
                    .collect(Collectors.toList());

            return Messenger.builder()
                    .code(200)
                    .message("최근 메시지 조회 성공")
                    .data(messages)
                    .build();
        } catch (Exception e) {
            log.error("최근 메시지 조회 중 오류 발생", e);
            return Messenger.builder()
                    .code(500)
                    .message("최근 메시지 조회 중 오류가 발생했습니다: " + e.getMessage())
                    .build();
        }
    }

    @Override
    @Transactional
    public int deleteMessagesOlderThanRetention() {
        LocalDateTime cutoff = cutoffNow();
        long count = groupChatRepository.countByCreatedAtBefore(cutoff);
        if (count > 0) {
            groupChatRepository.deleteByCreatedAtBefore(cutoff);
            log.info("단체채팅 24시간 경과 메시지 삭제: {} 건", count);
        }
        return (int) count;
    }

    @Override
    @Transactional
    public Messenger deleteAll() {
        try {
            long count = groupChatRepository.count();
            groupChatRepository.deleteAll();
            log.info("그룹 채팅 메시지 전체 삭제 성공: {} 개", count);
            return Messenger.builder()
                    .code(200)
                    .message("모든 메시지가 삭제되었습니다. (" + count + "개)")
                    .build();
        } catch (Exception e) {
            log.error("그룹 채팅 메시지 전체 삭제 중 오류 발생", e);
            return Messenger.builder()
                    .code(500)
                    .message("메시지 삭제 중 오류가 발생했습니다: " + e.getMessage())
                    .build();
        }
    }
}

