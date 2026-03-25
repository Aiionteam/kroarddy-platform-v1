package site.aiion.api.services.user;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "friend_requests",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"from_user_id", "to_user_id"})
    },
    indexes = {
        // listFriends / sendRequest 에서 (fromUserId, status) 조건으로 조회
        @Index(name = "idx_friend_req_from_status", columnList = "from_user_id, status"),
        // listPendingToMe / listFriends 에서 (toUserId, status) 조건으로 조회
        @Index(name = "idx_friend_req_to_status",   columnList = "to_user_id, status")
    }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FriendRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "from_user_id", nullable = false)
    private Long fromUserId;

    @Column(name = "to_user_id", nullable = false)
    private Long toUserId;

    /** PENDING, ACCEPTED, REJECTED */
    @Column(name = "status", length = 20, nullable = false)
    private String status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now(java.time.ZoneId.of("Asia/Seoul"));
        if (status == null) status = "PENDING";
    }
}
