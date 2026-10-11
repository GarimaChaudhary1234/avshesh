package com.avshesh.ratecard;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RateCardRepository extends JpaRepository<RateCard, Long> {

    List<RateCard> findByCollectorId(Long collectorId);

    List<RateCard> findByItemCode(String itemCode);

    void deleteByCollectorId(Long collectorId);
}
