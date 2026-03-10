package site.aiion.api.services.whisper;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import site.aiion.api.services.user.UserRepository;
import site.aiion.api.services.user.User;
import site.aiion.api.services.user.common.domain.Messenger;

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
        WhisperModel savedModel = toModel(saved);
        return Messenger.builder().code(200).message("귓속말을 보냈습니다.").data(savedModel).build();
    }

    @Override
    public Messenger findInbox(Long toUserId, Pageable pageable) {
        List<WhisperMessage> list = whisperRepository.findByToUserIdOrderByCreatedAtDesc(toUserId, pageable);
        List<WhisperModel> data = list.stream().map(this::toModel).collect(Collectors.toList());
        return Messenger.builder().code(200).message("받은 귓속말").data(data).build();
    }

    @Override
    public Messenger findSent(Long fromUserId, Pageable pageable) {
        List<WhisperMessage> list = whisperRepository.findByFromUserIdOrderByCreatedAtDesc(fromUserId, pageable);
        List<WhisperModel> data = list.stream().map(this::toModel).collect(Collectors.toList());
        return Messenger.builder().code(200).message("보낸 귓속말").data(data).build();
    }

    private WhisperModel toModel(WhisperMessage e) {
        String fromName = null, toName = null;
        if (e.getFromUserId() != null) {
            Optional<User> u = userRepository.findById(e.getFromUserId());
            fromName = u.map(uu -> uu.getNickname() != null && !uu.getNickname().isEmpty() ? uu.getNickname() : uu.getName()).orElse("사용자 " + e.getFromUserId());
        }
        if (e.getToUserId() != null) {
            Optional<User> u = userRepository.findById(e.getToUserId());
            toName = u.map(uu -> uu.getNickname() != null && !uu.getNickname().isEmpty() ? uu.getNickname() : uu.getName()).orElse("사용자 " + e.getToUserId());
        }
        return WhisperModel.builder()
                .id(e.getId())
                .fromUserId(e.getFromUserId())
                .toUserId(e.getToUserId())
                .fromUsername(fromName)
                .toUsername(toName)
                .message(e.getMessage())
                .createdAt(e.getCreatedAt())
                .readAt(e.getReadAt())
                .build();
    }
}
