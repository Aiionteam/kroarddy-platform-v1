package site.aiion.api.services.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {
    Optional<FriendRequest> findByFromUserIdAndToUserId(Long fromUserId, Long toUserId);
    List<FriendRequest> findByToUserIdAndStatus(Long toUserId, String status);
    List<FriendRequest> findByFromUserIdAndStatus(Long fromUserId, String status);

    /** 두 유저 간 양방향 친구 요청 레코드 전체 삭제 */
    @Modifying
    @Query("DELETE FROM FriendRequest f WHERE (f.fromUserId = :a AND f.toUserId = :b) OR (f.fromUserId = :b AND f.toUserId = :a)")
    int deleteBetween(@Param("a") Long a, @Param("b") Long b);
}
