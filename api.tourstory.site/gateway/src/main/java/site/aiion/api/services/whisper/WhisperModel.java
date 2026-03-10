package site.aiion.api.services.whisper;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WhisperModel {
    private Long id;
    private Long fromUserId;
    private Long toUserId;
    private String fromUsername;
    private String toUsername;
    private String message;
    private LocalDateTime createdAt;
    private LocalDateTime readAt;
}
