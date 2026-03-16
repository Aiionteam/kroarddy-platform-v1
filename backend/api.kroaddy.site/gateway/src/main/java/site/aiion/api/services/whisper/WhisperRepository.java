package site.aiion.api.services.whisper;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface WhisperRepository extends JpaRepository<WhisperMessage, Long> {

    List<WhisperMessage> findByToUserIdOrderByCreatedAtDesc(Long toUserId, Pageable pageable);

    List<WhisperMessage> findByFromUserIdOrderByCreatedAtDesc(Long fromUserId, Pageable pageable);

    /** 두 사용자 간 전체 대화 (양방향) 시간순 */
    @Query("""
            SELECT w FROM WhisperMessage w
            WHERE (w.fromUserId = :me AND w.toUserId = :other)
               OR (w.fromUserId = :other AND w.toUserId = :me)
            ORDER BY w.createdAt ASC
            """)
    List<WhisperMessage> findConversation(@Param("me") Long me, @Param("other") Long other, Pageable pageable);

    /** 나와 대화한 상대방 ID 목록 (중복 제거, 최신 메시지 기준 정렬) */
    @Query("""
            SELECT DISTINCT CASE
                WHEN w.fromUserId = :me THEN w.toUserId
                ELSE w.fromUserId
            END
            FROM WhisperMessage w
            WHERE w.fromUserId = :me OR w.toUserId = :me
            ORDER BY 1 ASC
            """)
    List<Long> findConversationPartnerIds(@Param("me") Long me);

    /** 두 사용자 간 최신 메시지 1건 */
    @Query("""
            SELECT w FROM WhisperMessage w
            WHERE (w.fromUserId = :me AND w.toUserId = :other)
               OR (w.fromUserId = :other AND w.toUserId = :me)
            ORDER BY w.createdAt DESC
            """)
    List<WhisperMessage> findLatestBetween(@Param("me") Long me, @Param("other") Long other, Pageable pageable);

    /** 내가 받은 메시지 중 아직 안 읽은 개수 */
    @Query("SELECT COUNT(w) FROM WhisperMessage w WHERE w.toUserId = :me AND w.readAt IS NULL")
    long countUnread(@Param("me") Long me);

    /** 특정 대화의 안 읽은 메시지 읽음 처리 */
    @Modifying
    @Query("""
            UPDATE WhisperMessage w SET w.readAt = :now
            WHERE w.toUserId = :me AND w.fromUserId = :other AND w.readAt IS NULL
            """)
    int markAsRead(@Param("me") Long me, @Param("other") Long other, @Param("now") LocalDateTime now);
}
