package site.aiion.api.services.whisper;

import org.springframework.data.domain.Pageable;
import site.aiion.api.services.user.common.domain.Messenger;

public interface WhisperService {
    Messenger send(Long fromUserId, WhisperModel model);
    Messenger findInbox(Long toUserId, Pageable pageable);
    Messenger findSent(Long fromUserId, Pageable pageable);
    /** 두 사용자 간 대화 스레드 조회 (SMS 방식) */
    Messenger findConversation(Long me, Long other, Pageable pageable);
    /** 내가 대화한 상대방 목록 (최신 메시지 포함) */
    Messenger findConversationList(Long me);
    /** 대화 읽음 처리 */
    Messenger markRead(Long me, Long other);
}
