package site.aiion.api.services.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserBlockRepository extends JpaRepository<UserBlock, Long> {
    Optional<UserBlock> findByBlockerIdAndBlockedId(Long blockerId, Long blockedId);
    List<UserBlock> findByBlockerIdOrderByCreatedAtDesc(Long blockerId);
    boolean existsByBlockerIdAndBlockedId(Long blockerId, Long blockedId);
}
