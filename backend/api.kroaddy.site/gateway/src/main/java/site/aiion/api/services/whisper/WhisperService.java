package site.aiion.api.services.whisper;

import org.springframework.data.domain.Pageable;
import site.aiion.api.services.user.common.domain.Messenger;

public interface WhisperService {
    Messenger send(Long fromUserId, WhisperModel model);
    Messenger findInbox(Long toUserId, Pageable pageable);
    Messenger findSent(Long fromUserId, Pageable pageable);
}
