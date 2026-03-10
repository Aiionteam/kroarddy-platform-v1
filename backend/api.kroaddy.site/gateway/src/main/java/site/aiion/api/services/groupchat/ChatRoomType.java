package site.aiion.api.services.groupchat;

/**
 * 명예도에 따른 단체채팅방 등급.
 * 실버(0~99) / 골드(100~499) / 플래티넘(500~999) / 다이아(1000~상한)
 * 상위 티어는 하위 티어 방 접근 가능.
 */
public enum ChatRoomType {
    SILVER(0),     // 0-99
    GOLD(100),     // 100-499
    PLATINUM(500), // 500-999
    DIAMOND(1000); // 1000 ~ MAX_HONOR

    /** 명예도 상한 (다이아 구간 포함) */
    public static final int MAX_HONOR = 9999;

    private final int minHonor;

    ChatRoomType(int minHonor) {
        this.minHonor = minHonor;
    }

    /** 이 방에 입장/채팅하기 위해 필요한 최소 명예도 */
    public int getMinHonor() {
        return minHonor;
    }

    /** 사용자 명예도로 접근 가능 여부 (상위 티어는 하위 방 접근 가능) */
    public boolean canAccess(int userHonor) {
        return userHonor >= minHonor;
    }

    public static ChatRoomType fromHonor(int honor) {
        int h = Math.min(Math.max(0, honor), MAX_HONOR);
        if (h >= 1000) return DIAMOND;
        if (h >= 500) return PLATINUM;
        if (h >= 100) return GOLD;
        return SILVER;
    }
}
