package site.aiion.api.services.user;

import java.util.List;
import site.aiion.api.services.user.common.domain.Messenger;

public interface UserService {
    public Messenger findById(UserModel userModel);
    public Messenger findByEmailAndProvider(String email, String provider);
    public Messenger findByProviderIdAndProvider(String providerId, String provider);
    public Messenger findAll();
    public Messenger save(UserModel userModel);
    public Messenger saveAll(List<UserModel> userModelList);
    public Messenger update(UserModel userModel);
    public Messenger delete(UserModel userModel);
    public Messenger updateRefreshToken(Long userId, String refreshToken);
    /** 명예도 올리기/내리기 (하루에 한 번만 voter→target에 대해 동일 액션 가능) */
    public Messenger voteHonor(Long voterId, Long targetUserId, String action);
}
