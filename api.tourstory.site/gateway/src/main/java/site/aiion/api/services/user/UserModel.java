package site.aiion.api.services.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
@Builder
@Data  // @Getter + @Setter 포함 (JSON 바인딩을 위해 @Setter 필요)
public class UserModel {
    private Long id;
    
    private String name;  // OAuth 제공자에서 받은 원본 이름
    
    private String email;
    
    private String nickname;  // 애플리케이션에서 사용할 닉네임
    
    // OAuth 제공자 정보 (google, naver, kakao)
    private String provider;
    
    // OAuth 제공자에서 받은 사용자 ID
    private String providerId;
    
    // Refresh Token (DB에 저장)
    private String refreshToken;

    /** 명예도 포인트 */
    private Integer honor;

    /** 등급 (명예도에서 계산: SILVER, GOLD, PLATINUM, DIAMOND) - 응답용 */
    private String tier;
}
