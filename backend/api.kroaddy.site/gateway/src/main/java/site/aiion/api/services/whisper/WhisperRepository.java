package site.aiion.api.services.whisper;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface WhisperRepository extends JpaRepository<WhisperMessage, Long> {
    List<WhisperMessage> findByToUserIdOrderByCreatedAtDesc(Long toUserId, org.springframework.data.domain.Pageable pageable);
    List<WhisperMessage> findByFromUserIdOrderByCreatedAtDesc(Long fromUserId, org.springframework.data.domain.Pageable pageable);
}
