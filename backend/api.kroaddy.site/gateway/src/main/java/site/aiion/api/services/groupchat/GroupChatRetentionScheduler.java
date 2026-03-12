package site.aiion.api.services.groupchat;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 단체채팅 메시지 24시간 보관 정책: 생성 후 24시간이 지난 메시지를 주기적으로 삭제.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GroupChatRetentionScheduler {

    private final GroupChatService groupChatService;

    /** 매 시 정각(0분)에 실행 (1시간마다) */
    @Scheduled(cron = "0 0 * * * *")
    public void deleteExpiredMessages() {
        try {
            int deleted = groupChatService.deleteMessagesOlderThanRetention();
            if (deleted > 0) {
                log.info("단체채팅 24시간 경과 메시지 삭제 완료: {} 건", deleted);
            }
        } catch (Exception e) {
            log.error("단체채팅 만료 메시지 삭제 중 오류", e);
        }
    }
}
