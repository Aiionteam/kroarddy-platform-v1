package site.aiion.api.services.groupchat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** 대화방 선택 UI용: 방 타입, 최소 명예도, 접근 가능 여부 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoomInfo {
    private String roomType;   // SILVER, GOLD, PLATINUM, DIAMOND
    private String label;      // 실버, 골드, 플래티넘, 다이아
    private int minHonor;
    private boolean accessible;
}
