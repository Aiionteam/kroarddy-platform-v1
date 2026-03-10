package site.aiion.api.services.user;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Entity
@Table(name = "honor_votes", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"voter_id", "target_id", "action", "vote_date"})
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HonorVote {

    /** 일일 기준 시간대: 태평양 자정(00:00)에 날짜가 바뀜 */
    public static final ZoneId VOTE_DATE_ZONE = ZoneId.of("America/Los_Angeles");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "voter_id", nullable = false)
    private Long voterId;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    /** UP(+1) or DOWN(-1) */
    @Column(name = "action", length = 10, nullable = false)
    private String action;

    @Column(name = "vote_date", nullable = false)
    private LocalDate voteDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (voteDate == null) voteDate = LocalDate.now(VOTE_DATE_ZONE);
        if (createdAt == null) createdAt = LocalDateTime.now(VOTE_DATE_ZONE);
    }
}
