package site.aiion.api.services.groupchat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupChatModel {
    private Long id;
    private String roomType;  // SILVER, GOLD, PLATINUM, DIAMOND
    private Long userId;
    private String username;
    private String message;
    private Boolean lookingForBuddy;  // true면 "여행 같이 갈 사람" → 귓속말 가능
    private LocalDateTime createdAt;
}

