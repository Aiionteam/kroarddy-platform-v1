package site.aiion.api.services.user;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import site.aiion.api.services.user.common.domain.Messenger;

@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final HonorVoteRepository honorVoteRepository;

    @PersistenceContext
    private EntityManager entityManager;

    private static String honorToTier(int honor) {
        int h = Math.max(0, Math.min(site.aiion.api.services.groupchat.ChatRoomType.MAX_HONOR, honor));
        if (h >= 1000) return "DIAMOND";
        if (h >= 500) return "PLATINUM";
        if (h >= 100) return "GOLD";
        return "SILVER";
    }

    private UserModel entityToModel(User entity) {
        int h = entity.getHonor() != null ? entity.getHonor() : 0;
        h = Math.max(0, Math.min(site.aiion.api.services.groupchat.ChatRoomType.MAX_HONOR, h));
        return UserModel.builder()
                .id(entity.getId())
                .name(entity.getName())
                .email(entity.getEmail())
                .nickname(entity.getNickname())
                .provider(entity.getProvider())
                .providerId(entity.getProviderId())
                .refreshToken(entity.getRefreshToken())
                .honor(h)
                .tier(honorToTier(h))
                .build();
    }

    private User modelToEntity(UserModel model) {
        // nickname이 없으면 name과 동일하게 설정
        String nickname = model.getNickname();
        if (nickname == null || nickname.trim().isEmpty()) {
            nickname = model.getName();
        }
        
        Integer honor = model.getHonor() != null ? model.getHonor() : 0;
        return User.builder()
                .id(model.getId())
                .name(model.getName())
                .email(model.getEmail())
                .nickname(nickname)
                .provider(model.getProvider())
                .providerId(model.getProviderId())
                .refreshToken(model.getRefreshToken())
                .honor(honor)
                .build();
    }

    @Override
    public Messenger findById(UserModel userModel) {
        if (userModel.getId() == null) {
            return Messenger.builder()
                    .code(400)
                    .message("ID가 필요합니다.")
                    .build();
        }
        Optional<User> entity = userRepository.findById(userModel.getId());
        if (entity.isPresent()) {
            UserModel model = entityToModel(entity.get());
            return Messenger.builder()
                    .code(200)
                    .message("조회 성공")
                    .data(model)
                    .build();
        } else {
            return Messenger.builder()
                    .code(404)
                    .message("사용자를 찾을 수 없습니다.")
                    .build();
        }
    }

    @Override
    public Messenger findByEmailAndProvider(String email, String provider) {
        if (email == null || email.trim().isEmpty()) {
            return Messenger.builder()
                    .code(400)
                    .message("이메일이 필요합니다.")
                    .build();
        }
        if (provider == null || provider.trim().isEmpty()) {
            return Messenger.builder()
                    .code(400)
                    .message("제공자 정보가 필요합니다.")
                    .build();
        }
        
        Optional<User> entity = userRepository.findByEmailAndProvider(email, provider);
        if (entity.isPresent()) {
            UserModel model = entityToModel(entity.get());
            return Messenger.builder()
                    .code(200)
                    .message("조회 성공")
                    .data(model)
                    .build();
        } else {
            return Messenger.builder()
                    .code(404)
                    .message("사용자를 찾을 수 없습니다.")
                    .build();
        }
    }

    @Override
    public Messenger findByProviderIdAndProvider(String providerId, String provider) {
        if (providerId == null || providerId.trim().isEmpty()) {
            return Messenger.builder()
                    .code(400)
                    .message("Provider ID가 필요합니다.")
                    .build();
        }
        if (provider == null || provider.trim().isEmpty()) {
            return Messenger.builder()
                    .code(400)
                    .message("제공자 정보가 필요합니다.")
                    .build();
        }
        
        Optional<User> entity = userRepository.findByProviderIdAndProvider(providerId, provider);
        if (entity.isPresent()) {
            UserModel model = entityToModel(entity.get());
            return Messenger.builder()
                    .code(200)
                    .message("조회 성공")
                    .data(model)
                    .build();
        } else {
            return Messenger.builder()
                    .code(404)
                    .message("사용자를 찾을 수 없습니다.")
                    .build();
        }
    }

    @Override
    public Messenger findAll() {
        List<User> entities = userRepository.findAll();
        List<UserModel> modelList = entities.stream()
                .map(this::entityToModel)
                .collect(Collectors.toList());
        return Messenger.builder()
                .code(200)
                .message("전체 조회 성공: " + modelList.size() + "개")
                .data(modelList)
                .build();
    }

    @Override
    @Transactional
    public Messenger save(UserModel userModel) {
        // save 전에 먼저 조회 시도 (중복 키 에러 방지)
        if (userModel.getEmail() != null && userModel.getProvider() != null) {
            Optional<User> existingUser = userRepository.findByEmailAndProvider(
                userModel.getEmail(), 
                userModel.getProvider()
            );
            if (existingUser.isPresent()) {
                // 이미 존재하는 사용자 - 기존 사용자 정보 반환
                UserModel model = entityToModel(existingUser.get());
                return Messenger.builder()
                        .code(200)
                        .message("이미 존재하는 사용자: " + existingUser.get().getId())
                        .data(model)
                        .build();
            }
        }
        
        // 사용자가 없으면 새로 저장
        try {
            User entity = modelToEntity(userModel);
            User saved = userRepository.save(entity);
            UserModel model = entityToModel(saved);
            return Messenger.builder()
                    .code(200)
                    .message("저장 성공: " + saved.getId())
                    .data(model)
                    .build();
        } catch (DataIntegrityViolationException e) {
            // 예외적으로 중복 키 에러가 발생한 경우 (동시성 문제 등)
            // 기존 사용자 다시 조회 시도
            if (userModel.getEmail() != null && userModel.getProvider() != null) {
                Optional<User> existingUser = userRepository.findByEmailAndProvider(
                    userModel.getEmail(), 
                    userModel.getProvider()
                );
                if (existingUser.isPresent()) {
                    UserModel model = entityToModel(existingUser.get());
                    return Messenger.builder()
                            .code(200)
                            .message("이미 존재하는 사용자: " + existingUser.get().getId())
                            .data(model)
                            .build();
                }
            }
            // 조회 실패 시 에러 반환
            return Messenger.builder()
                    .code(409)
                    .message("이미 존재하는 사용자입니다. 이메일: " + userModel.getEmail())
                    .build();
        }
    }

    @Override
    @Transactional
    public Messenger saveAll(List<UserModel> userModelList) {
        List<User> entities = userModelList.stream()
                .map(this::modelToEntity)
                .collect(Collectors.toList());
        
        List<User> saved = userRepository.saveAll(entities);
        return Messenger.builder()
                .code(200)
                .message("일괄 저장 성공: " + saved.size() + "개")
                .build();
    }

    @Override
    @Transactional
    public Messenger update(UserModel userModel) {
        if (userModel.getId() == null) {
            return Messenger.builder()
                    .code(400)
                    .message("ID가 필요합니다.")
                    .build();
        }
        Optional<User> optionalEntity = userRepository.findById(userModel.getId());
        if (optionalEntity.isPresent()) {
            User existing = optionalEntity.get();
            
            int rawHonor = userModel.getHonor() != null ? userModel.getHonor() : (existing.getHonor() != null ? existing.getHonor() : 0);
            Integer honor = Math.max(0, Math.min(site.aiion.api.services.groupchat.ChatRoomType.MAX_HONOR, rawHonor));
            User updated = User.builder()
                    .id(existing.getId())
                    .name(userModel.getName() != null ? userModel.getName() : existing.getName())
                    .email(userModel.getEmail() != null ? userModel.getEmail() : existing.getEmail())
                    .nickname(userModel.getNickname() != null ? userModel.getNickname() : existing.getNickname())
                    .provider(userModel.getProvider() != null ? userModel.getProvider() : existing.getProvider())
                    .providerId(userModel.getProviderId() != null ? userModel.getProviderId() : existing.getProviderId())
                    .refreshToken(userModel.getRefreshToken() != null ? userModel.getRefreshToken() : existing.getRefreshToken())
                    .honor(honor)
                    .build();
            
            User saved = userRepository.save(updated);
            UserModel model = entityToModel(saved);
            return Messenger.builder()
                    .code(200)
                    .message("수정 성공: " + userModel.getId())
                    .data(model)
                    .build();
        } else {
            return Messenger.builder()
                    .code(404)
                    .message("수정할 사용자를 찾을 수 없습니다.")
                    .build();
        }
    }

    @Override
    @Transactional
    public Messenger delete(UserModel userModel) {
        if (userModel.getId() == null) {
            return Messenger.builder()
                    .code(400)
                    .message("ID가 필요합니다.")
                    .build();
        }
        Optional<User> optionalEntity = userRepository.findById(userModel.getId());
        if (optionalEntity.isPresent()) {
            userRepository.deleteById(userModel.getId());
            return Messenger.builder()
                    .code(200)
                    .message("삭제 성공: " + userModel.getId())
                    .build();
        } else {
            return Messenger.builder()
                    .code(404)
                    .message("삭제할 사용자를 찾을 수 없습니다.")
                    .build();
        }
    }

    @Override
    @Transactional
    public Messenger updateRefreshToken(Long userId, String refreshToken) {
        if (userId == null) {
            return Messenger.builder()
                    .code(400)
                    .message("사용자 ID가 필요합니다.")
                    .build();
        }
        
        Optional<User> optionalEntity = userRepository.findById(userId);
        if (optionalEntity.isPresent()) {
            User existing = optionalEntity.get();
            User updated = User.builder()
                    .id(existing.getId())
                    .name(existing.getName())
                    .email(existing.getEmail())
                    .nickname(existing.getNickname())
                    .provider(existing.getProvider())
                    .providerId(existing.getProviderId())
                    .refreshToken(refreshToken)
                    .honor(existing.getHonor() != null ? existing.getHonor() : 0)
                    .build();
            
            userRepository.save(updated);
            return Messenger.builder()
                    .code(200)
                    .message("Refresh Token 업데이트 성공: " + userId)
                    .build();
        } else {
            return Messenger.builder()
                    .code(404)
                    .message("사용자를 찾을 수 없습니다.")
                    .build();
        }
    }

    @Override
    @Transactional
    public Messenger voteHonor(Long voterId, Long targetUserId, String action) {
        if (voterId == null || targetUserId == null) {
            return Messenger.builder().code(400).message("voter와 target이 필요합니다.").build();
        }
        if (voterId.equals(targetUserId)) {
            return Messenger.builder().code(400).message("자기 자신에게는 투표할 수 없습니다.").build();
        }
        String act = "UP".equalsIgnoreCase(action) ? "UP" : "DOWN".equalsIgnoreCase(action) ? "DOWN" : null;
        if (act == null) {
            return Messenger.builder().code(400).message("action은 UP 또는 DOWN이어야 합니다.").build();
        }
        // 태평양 자정 기준 날짜 (24시에 기회 리셋)
        LocalDate todayPacific = LocalDate.now(HonorVote.VOTE_DATE_ZONE);
        if (honorVoteRepository.findByVoterIdAndTargetIdAndActionAndVoteDate(voterId, targetUserId, act, todayPacific).isPresent()) {
            return Messenger.builder().code(400).message("오늘(태평양 기준) 이미 해당 사용자에게 " + (act.equals("UP") ? "명예도 올리기" : "명예도 내리기") + "를 했습니다.").build();
        }
        final int dailyLimit = 3;
        long countSameAction = honorVoteRepository.countByVoterIdAndActionAndVoteDate(voterId, act, todayPacific);
        if (countSameAction >= dailyLimit) {
            return Messenger.builder()
                    .code(400)
                    .message("오늘(태평양 기준) 명예도 " + (act.equals("UP") ? "올리기" : "내리기") + "는 " + dailyLimit + "번까지 가능합니다. 내일 다시 시도해 주세요.")
                    .build();
        }
        Optional<User> targetOpt = userRepository.findById(targetUserId);
        if (targetOpt.isEmpty()) {
            return Messenger.builder().code(404).message("대상 사용자를 찾을 수 없습니다.").build();
        }
        User target = targetOpt.get();
        int current = target.getHonor() != null ? target.getHonor() : 0;
        // 명예도 상한 1000: 이미 1000 이상이면 올리기 불가
        if ("UP".equals(act) && current >= 1000) {
            return Messenger.builder()
                    .code(400)
                    .message("대상 사용자의 명예도가 이미 상한(1000)에 도달하여 더 올릴 수 없습니다.")
                    .build();
        }
        int delta = "UP".equals(act) ? 1 : -1;
        int newHonor = Math.max(0, Math.min(site.aiion.api.services.groupchat.ChatRoomType.MAX_HONOR, current + delta));
        honorVoteRepository.save(HonorVote.builder()
                .voterId(voterId)
                .targetId(targetUserId)
                .action(act)
                .voteDate(todayPacific)
                .build());
        User updated = User.builder()
                .id(target.getId())
                .name(target.getName())
                .email(target.getEmail())
                .nickname(target.getNickname())
                .provider(target.getProvider())
                .providerId(target.getProviderId())
                .refreshToken(target.getRefreshToken())
                .honor(newHonor)
                .build();
        userRepository.save(updated);
        return Messenger.builder()
                .code(200)
                .message(act.equals("UP") ? "명예도를 올렸습니다." : "명예도를 내렸습니다.")
                .data(entityToModel(updated))
                .build();
    }

}
