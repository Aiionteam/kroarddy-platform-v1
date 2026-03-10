package site.aiion.api.services.user;

import site.aiion.api.services.user.common.domain.Messenger;

public interface FriendService {
    Messenger sendRequest(Long fromUserId, Long toUserId);
    Messenger listPendingToMe(Long toUserId);
    Messenger accept(Long toUserId, Long fromUserId);
    Messenger listFriends(Long userId);
}
