package com.avshesh.pickup;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.listing.PickupInfo;
import com.avshesh.listing.PickupInfoProvider;

/** Answers the listing module's question "what is happening with my pickup?" without exposing entities. */
@Service
@Transactional(readOnly = true)
public class PickupInfoService implements PickupInfoProvider {

    private final PickupRepository pickups;
    private final PickupStopRepository stops;

    public PickupInfoService(PickupRepository pickups, PickupStopRepository stops) {
        this.pickups = pickups;
        this.stops = stops;
    }

    @Override
    public Map<Long, PickupInfo> forListings(Collection<Long> listingIds) {
        if (listingIds.isEmpty()) {
            return Map.of();
        }
        List<PickupStop> found = stops.findByListingIdIn(listingIds);
        Map<Long, Pickup> byId = pickups.findAllById(found.stream().map(PickupStop::getPickupId).distinct().toList())
                .stream().collect(Collectors.toMap(Pickup::getId, p -> p));

        Map<Long, PickupInfo> result = new HashMap<>();
        for (PickupStop s : found) {
            Pickup p = byId.get(s.getPickupId());
            result.put(s.getListingId(), new PickupInfo(p.getCollectorId(), p.getScheduledStart(), p.getScheduledEnd(),
                    s.getActualKg(), s.getAmountPaid(), s.getDoneAt(), s.getPaymentStatus().name()));
        }
        return result;
    }
}
