package site.aiion.api.services.whisper;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import site.aiion.api.services.user.UserRepository;
import site.aiion.api.services.user.User;
import site.aiion.api.services.user.common.domain.Messenger;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WhisperServiceImpl implements WhisperService {

    private final WhisperRepository whisperRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public Messenger send(Long fromUserId, WhisperModel model) {
        if (model.getToUserId() == null) {
            return Messenger.builder().code(400).message("받는 사용자 ID가 필요합니다.").build();
        }
        if (model.getMessage() == null || model.getMessage().trim().isEmpty()) {
            return Messenger.builder().code(400).message("메시지 내용이 필요합니다.").build();
        }
        if (fromUserId.equals(model.getToUserId())) {
            return Messenger.builder().code(400).message("자기 자신에게는 귓속말을 보낼 수 없습니다.").build();
        }
        WhisperMessage entity = WhisperMessage.builder()
                .fromUserId(fromUserId)
                .toUserId(model.getToUserId())
                .message(model.getMessage().trim())
                .build();
        WhisperMessage saved = whisperRepository.save(entity);
        return Messenger.builder().code(200).message("귓속말을 보냈습니다.").data(toModel(saved)).build();
    }

    @Override
    public Messenger findInbox(Long toUserId, Pageable pageable) {
        List<WhisperModel> data = whisperRepository
                .findByToUserIdOrderByCreatedAtDesc(toUserId, pageable)
                .stream().map(this::toModel).collect(Collectors.toList());
        return Messenger.builder().code(200).message("받은 귓속말").data(data).build();
    }

    @Override
    public Messenger findSent(Long fromUserId, Pageable pageable) {
        List<WhisperModel> data = whisperRepository
                .findByFromUserIdOrderByCreatedAtDesc(fromUserId, pageable)
                .stream().map(this::toModel).collect(Collectors.toList());
        return Messenger.builder().code(200).message("보낸 귓속말").data(data).build();
    }

    @Override
    public Messenger findConversation(Long me, Long other, Pageable pageable) {
        List<WhisperModel> data = whisperRepository
                .findConversation(me, other, pageable)
                .stream().map(this::toModel).collect(Collectors.toList());
        return Messenger.builder().code(200).message("대화 스레드").data(data).build();
    }

    @Override
    public Messenger findConversationList(Long me) {
        List<Long> partnerIds = whisperRepository.findConversationPartnerIds(me);
        List<WhisperConversationSummary> summaries = new ArrayList<>();
        for (Long partnerId : partnerIds) {
            List<WhisperMessage> latest = whisperRepository.findLatestBetween(me, partnerId, PageRequest.of(0, 1));
            if (latest.isEmpty()) continue;
            WhisperMessage lastMsg = latest.get(0);
            String partnerName = resolveUsername(partnerId);
            long unread = whisperRepository.countUnread(me);
            summaries.add(WhisperConversationSummary.builder()
                    .partnerId(partnerId)
                    .partnerName(partnerName)
                    .lastMessage(lastMsg.getMessage())
                    .lastMessageAt(lastMsg.getCreatedAt())
                    .unreadCount(unread)
                    .build());
        }
        // 최신 메시지 순 정렬
        summaries.sort((a, b) -> {
            if (a.getLastMessageAt() == null) return 1;
            if (b.getLastMessageAt() == null) return -1;
            return b.getLastMessageAt().compareTo(a.getLastMessageAt());
        });
        return Messenger.builder().code(200).message("대화 목록").data(summaries).build();
    }

    @Override
    @Transactional
    public Messenger deleteConversation(Long me, Long other) {
        int deleted = whisperRepository.deleteConversation(me, other);
        return Messenger.builder().code(200).message(deleted + "개 메시지 삭제 완료").build();
    }

    @Override
    @Transactional
    public Messenger markRead(Long me, Long other) {
        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
        int count = whisperRepository.markAsRead(me, other, now);
        return Messenger.builder().code(200).message(count + "개 읽음 처리").build();
    }

    private String resolveUsername(Long userId) {
        if (userId == null) return "알 수 없음";
        return userRepository.findById(userId)
                .map(u -> u.getNickname() != null && !u.getNickname().isEmpty() ? u.getNickname() : u.getName())
                .orElse("사용자 " + userId);
    }

    private WhisperModel toModel(WhisperMessage e) {
        return WhisperModel.builder()
                .id(e.getId())
                .fromUserId(e.getFromUserId())
                .toUserId(e.getToUserId())
                .fromUsername(resolveUsername(e.getFromUserId()))
                .toUsername(resolveUsername(e.getToUserId()))
                .message(e.getMessage())
                .createdAt(e.getCreatedAt())
                .readAt(e.getReadAt())
                .build();
    }
}
