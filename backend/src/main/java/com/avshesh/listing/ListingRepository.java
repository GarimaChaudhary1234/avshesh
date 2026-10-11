package com.avshesh.listing;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ListingRepository extends JpaRepository<Listing, Long> {

    List<Listing> findByOwnerIdOrderByIdDesc(Long ownerId);

    boolean existsByOwnerIdAndStatusNot(Long ownerId, ListingStatus status);

    List<Listing> findByPoolId(Long poolId);

    List<Listing> findByPoolIdIn(Collection<Long> poolIds);
}
