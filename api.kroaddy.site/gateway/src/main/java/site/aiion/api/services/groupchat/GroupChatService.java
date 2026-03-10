package site.aiion.api.services.groupchat;

import org.springframework.data.domain.Pageable;
import site.aiion.api.services.user.common.domain.Messenger;

public interface GroupChatService {
    /**
     * 그룹 채팅 메시지 저장 (모든 사용자 가능)
     */
    Messenger save(GroupChatModel groupChatModel);
    
    /**
     * 그룹 채팅 메시지 목록 조회 (최신순, 페이징)
     */
    Messenger findAll(Pageable pageable);
    
    /**
     * 최근 메시지 N개 조회 (방별)
     */
    Messenger findRecentMessages(String roomType, int limit);
    
    /**
     * 24시간이 지난 메시지 삭제 (스케줄러에서 호출)
     */
    int deleteMessagesOlderThanRetention();

    /**
     * 모든 메시지 삭제 (관리자만 가능)
     */
    Messenger deleteAll();
}

