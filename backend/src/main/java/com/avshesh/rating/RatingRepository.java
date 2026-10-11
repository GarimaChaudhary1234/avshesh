package com.avshesh.rating;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RatingRepository extends JpaRepository<Rating, Long> {

    boolean existsByListingId(Long listingId);

    long countByCollectorIdAndHouseholdIpHashAndCreatedAtAfter(Long collectorId, String householdIpHash, java.time.LocalDateTime after);

    List<Rating> findByHouseholdIdOrderByIdDesc(Long householdId);

    List<Rating> findTop5ByCollectorIdAndCommentIsNotNullOrderByIdDesc(Long collectorId);

    /** Rows of {collectorId, average stars, number of ratings}. */
    /** Rows of {collectorId, sum of stars x weight, sum of weights, number of ratings}. */
    @Query("select r.collectorId, sum(r.stars * r.weight), sum(r.weight), count(r) from Rating r where r.collectorId in :ids group by r.collectorId")
    List<Object[]> summaries(@Param("ids") Collection<Long> ids);
}
