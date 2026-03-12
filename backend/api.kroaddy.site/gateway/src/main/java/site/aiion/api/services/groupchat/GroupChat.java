package site.aiion.api.services.groupchat;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "group_chats")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupChat {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 실버/골드/플래티넘/다이아 방 구분 (기존 행 호환용 nullable) */
    @Enumerated(EnumType.STRING)
    @Column(name = "room_type", length = 20)
    private ChatRoomType roomType;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "username", length = 100)
    private String username;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String message;

    /** 여행 같이 갈 사람 찾기 메시지 여부 (true면 귓속말 버튼 노출) */
    @Column(name = "looking_for_buddy")
    private Boolean lookingForBuddy = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        // 한국 시간(KST) 기준으로 저장
        createdAt = LocalDateTime.now(java.time.ZoneId.of("Asia/Seoul"));
    }
}

