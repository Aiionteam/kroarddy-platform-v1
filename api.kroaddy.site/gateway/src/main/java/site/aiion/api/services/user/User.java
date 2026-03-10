package site.aiion.api.services.user;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"email", "provider"})
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;  // OAuth 제공자에서 받은 원본 이름 (참고용)

    private String email;

    // 애플리케이션에서 사용할 닉네임 (변경 가능, 초기값은 name과 동일)
    private String nickname;

    // OAuth 제공자 정보 (google, naver, kakao) - OAuth 전용이므로 필수
    private String provider;

    // OAuth 제공자에서 받은 사용자 ID (예: google_id, kakao_id, naver_id)
    @Column(name = "provider_id", nullable = false)
    private String providerId;

    // Refresh Token 저장 (HttpOnly 쿠키와 별도로 DB에도 저장하여 검증)
    @Column(name = "refresh_token", length = 1000)
    private String refreshToken;

    /** 명예도 (0~). 등급: 실버(0~99), 골드(100~499), 플래티넘(500~999), 다이아(1000+) */
    @Column(name = "honor", nullable = false, columnDefinition = "integer not null default 0")
    private Integer honor = 0;

    // Commented out because Diary type is not resolved.
    // @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    // private List<Diary> diaries;
}

