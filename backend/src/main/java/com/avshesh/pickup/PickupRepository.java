package com.avshesh.pickup;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PickupRepository extends JpaRepository<Pickup, Long> {

    List<Pickup> findByCollectorIdOrderByIdDesc(Long collectorId);

    boolean existsByCollectorIdAndStatus(Long collectorId, PickupStatus status);
}
