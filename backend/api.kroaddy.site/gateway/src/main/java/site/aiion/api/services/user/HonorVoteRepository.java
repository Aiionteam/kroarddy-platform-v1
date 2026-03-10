package site.aiion.api.services.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface HonorVoteRepository extends JpaRepository<HonorVote, Long> {
    Optional<HonorVote> findByVoterIdAndTargetIdAndActionAndVoteDate(Long voterId, Long targetId, String action, LocalDate voteDate);

    /** 태평양 기준 해당 날짜에 투표자가 해당 액션(UP/DOWN)을 한 횟수. 일당 3회 제한용 */
    long countByVoterIdAndActionAndVoteDate(Long voterId, String action, LocalDate voteDate);
}
