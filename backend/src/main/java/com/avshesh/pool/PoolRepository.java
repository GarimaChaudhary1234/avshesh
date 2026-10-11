package com.avshesh.pool;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface PoolRepository extends JpaRepository<Pool, Long> {

    List<Pool> findByWasteTypeAndStatusIn(WasteType type, Collection<PoolStatus> statuses);

    /** Open pools of one kind whose centre lies in a box. The exact distance is checked afterwards. */
    @Query("select p from Pool p where p.wasteType = :type and p.status in :statuses"
            + " and p.centerLat between :minLat and :maxLat and p.centerLng between :minLng and :maxLng")
    List<Pool> findOpenInBox(@Param("type") WasteType type, @Param("statuses") Collection<PoolStatus> statuses,
                             @Param("minLat") double minLat, @Param("maxLat") double maxLat,
                             @Param("minLng") double minLng, @Param("maxLng") double maxLng);

    List<Pool> findByCollectorId(Long collectorId);

    long countByStatus(PoolStatus status);

    long countByStatusAndWardId(PoolStatus status, Long wardId);

    /**
     * A lock held until the end of the transaction, one per mohalla and waste type. Households who list at the
     * same moment are queued, so they share one pool instead of each creating their own.
     */
    @Query(value = "select cast(pg_advisory_xact_lock(:key) as text)", nativeQuery = true)
    String lockCell(@Param("key") long key);

    /** Row lock so two collectors cannot accept the same pool at once. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Pool p where p.id = :id")
    Optional<Pool> lockById(@Param("id") Long id);
}
