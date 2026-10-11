package com.avshesh.municipal;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CollectionPointRepository extends JpaRepository<CollectionPoint, Long> {

    List<CollectionPoint> findByActiveTrue();

    List<CollectionPoint> findAllByOrderByIdDesc();

    List<CollectionPoint> findByWardIdOrderByIdDesc(Long wardId);

    long countByActiveTrueAndWardId(Long wardId);
}
