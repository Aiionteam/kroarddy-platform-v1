package site.aiion.api.services.user;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import site.aiion.api.services.user.common.domain.Messenger;

@Service
@RequiredArgsConstructor
public class FriendServiceImpl implements FriendService {

    private final FriendRequestRepository friendRequestRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public Messenger sendRequest(Long fromUserId, Long toUserId) {
        if (fromUserId == null || toUserId == null) {
            return Messenger.builder().code(400).message("fromUserId와 toUserId가 필요합니다.").build();
        }
        if (fromUserId.equals(toUserId)) {
            return Messenger.builder().code(400).message("자기 자신에게 친구 요청을 보낼 수 없습니다.").build();
        }
        if (userRepository.findById(toUserId).isEmpty()) {
            return Messenger.builder().code(404).message("대상 사용자를 찾을 수 없습니다.").build();
        }
        Optional<FriendRequest> existing = friendRequestRepository.findByFromUserIdAndToUserId(fromUserId, toUserId);
        if (existing.isPresent()) {
            String status = existing.get().getStatus();
            if ("PENDING".equals(status)) {
                return Messenger.builder().code(400).message("이미 친구 요청을 보냈습니다.").build();
            }
            if ("ACCEPTED".equals(status)) {
                return Messenger.builder().code(400).message("이미 친구입니다.").build();
            }
        }
        Optional<FriendRequest> reverse = friendRequestRepository.findByFromUserIdAndToUserId(toUserId, fromUserId);
        if (reverse.isPresent() && "PENDING".equals(reverse.get().getStatus())) {
            return Messenger.builder().code(400).message("해당 사용자가 이미 나에게 친구 요청을 보냈습니다. 수락 목록을 확인하세요.").build();
        }
        if (existing.isPresent()) {
            existing.get().setStatus("PENDING");
            friendRequestRepository.save(existing.get());
        } else {
            friendRequestRepository.save(FriendRequest.builder()
                    .fromUserId(fromUserId)
                    .toUserId(toUserId)
                    .status("PENDING")
                    .build());
        }
        return Messenger.builder().code(200).message("친구 요청을 보냈습니다.").build();
    }

    @Override
    public Messenger listPendingToMe(Long toUserId) {
        List<FriendRequest> list = friendRequestRepository.findByToUserIdAndStatus(toUserId, "PENDING");
        List<Long> fromIds = list.stream().map(FriendRequest::getFromUserId).distinct().collect(Collectors.toList());
        if (fromIds.isEmpty()) {
            return Messenger.builder().code(200).message("받은 친구 요청").data(new ArrayList<>()).build();
        }
        // N+1 → WHERE id IN (...) 단일 쿼리
        List<UserModel> users = userRepository.findAllById(fromIds).stream()
                .map(this::toModel)
                .collect(Collectors.toList());
        return Messenger.builder().code(200).message("받은 친구 요청").data(users).build();
    }

    @Override
    @Transactional
    public Messenger accept(Long toUserId, Long fromUserId) {
        Optional<FriendRequest> req = friendRequestRepository.findByFromUserIdAndToUserId(fromUserId, toUserId);
        if (req.isEmpty() || !"PENDING".equals(req.get().getStatus())) {
            return Messenger.builder().code(404).message("해당 친구 요청을 찾을 수 없습니다.").build();
        }
        req.get().setStatus("ACCEPTED");
        friendRequestRepository.save(req.get());
        return Messenger.builder().code(200).message("친구 요청을 수락했습니다.").build();
    }

    @Override
    public Messenger listFriends(Long userId) {
        // 기존: sent + received 두 번 쿼리 → 단일 OR 쿼리로 통합
        List<FriendRequest> accepted = friendRequestRepository.findAcceptedByUserId(userId);
        List<Long> friendIds = accepted.stream()
                .map(f -> f.getFromUserId().equals(userId) ? f.getToUserId() : f.getFromUserId())
                .distinct()
                .collect(Collectors.toList());
        if (friendIds.isEmpty()) {
            return Messenger.builder().code(200).message("친구 목록").data(new ArrayList<>()).build();
        }
        // N+1 → WHERE id IN (...) 단일 쿼리
        List<UserModel> friends = userRepository.findAllById(friendIds).stream()
                .map(this::toModel)
                .collect(Collectors.toList());
        return Messenger.builder().code(200).message("친구 목록").data(friends).build();
    }

    @Override
    @Transactional
    public Messenger removeFriend(Long me, Long targetId) {
        int deleted = friendRequestRepository.deleteBetween(me, targetId);
        if (deleted == 0) {
            return Messenger.builder().code(404).message("친구 관계를 찾을 수 없습니다.").build();
        }
        return Messenger.builder().code(200).message("친구를 삭제했습니다.").build();
    }

    private UserModel toModel(User u) {
        int h = u.getHonor() != null ? u.getHonor() : 0;
        String tier = h >= 1000 ? "DIAMOND" : h >= 500 ? "PLATINUM" : h >= 100 ? "GOLD" : "SILVER";
        return UserModel.builder()
                .id(u.getId())
                .name(u.getName())
                .email(u.getEmail())
                .nickname(u.getNickname())
                .honor(h)
                .tier(tier)
                .build();
    }
}
