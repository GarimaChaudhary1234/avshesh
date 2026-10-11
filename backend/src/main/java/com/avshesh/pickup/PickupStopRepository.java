package com.avshesh.pickup;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PickupStopRepository extends JpaRepository<PickupStop, Long> {

    List<PickupStop> findByPickupIdOrderBySeq(Long pickupId);

    List<PickupStop> findByPickupIdIn(Collection<Long> pickupIds);

    List<PickupStop> findByListingIdIn(Collection<Long> listingIds);

    Optional<PickupStop> findFirstByListingId(Long listingId);

    List<PickupStop> findByPaymentStatusInOrderByIdDesc(Collection<PaymentStatus> statuses);
}
