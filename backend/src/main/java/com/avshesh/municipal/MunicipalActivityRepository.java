package com.avshesh.municipal;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface MunicipalActivityRepository extends JpaRepository<MunicipalActivity, Long> {

    List<MunicipalActivity> findTop50ByOrderByIdDesc();

    List<MunicipalActivity> findTop50ByWardIdOrderByIdDesc(Long wardId);

    List<MunicipalActivity> findTop50ByActorIdOrderByIdDesc(Long actorId);

    /** Rows of {actorId, last action time, number of actions}. */
    @Query("select a.actorId, max(a.createdAt), count(a) from MunicipalActivity a group by a.actorId")
    List<Object[]> summaryByActor();

    /** Rows of {wardId, last action time}. */
    @Query("select a.wardId, max(a.createdAt) from MunicipalActivity a where a.wardId is not null group by a.wardId")
    List<Object[]> lastActionByWard();
}
