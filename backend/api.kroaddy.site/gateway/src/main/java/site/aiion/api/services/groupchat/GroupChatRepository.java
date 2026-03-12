package site.aiion.api.services.groupchat;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface GroupChatRepository extends JpaRepository<GroupChat, Long> {

    Page<GroupChat> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<GroupChat> findByIdGreaterThanOrderByCreatedAtAsc(Long id);

    List<GroupChat> findTop50ByOrderByCreatedAtDesc();

    /** 방별 최신 메시지 N개 (24시간 이내만) */
    List<GroupChat> findTop50ByRoomTypeAndCreatedAtAfterOrderByCreatedAtDesc(ChatRoomType roomType, LocalDateTime after);

    /** 방별 lastId 초과 메시지 (SSE 푸시용, 24시간 이내만) */
    List<GroupChat> findByIdGreaterThanAndRoomTypeAndCreatedAtAfterOrderByCreatedAtAsc(Long id, ChatRoomType roomType, LocalDateTime after);

    /** 24시간 지난 메시지 개수 (삭제 전 로깅용) */
    long countByCreatedAtBefore(LocalDateTime before);

    /** 24시간 지난 메시지 일괄 삭제 */
    void deleteByCreatedAtBefore(LocalDateTime before);
}

