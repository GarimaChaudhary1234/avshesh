package com.avshesh.pickup;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.listing.ListingLookup;
import com.avshesh.listing.ListingSummary;
import com.avshesh.user.UserAccount;
import com.avshesh.user.UserDirectory;

/** Read-only pickup views for the collector. A stop carries where to go and who to call. */
@Service
@Transactional(readOnly = true)
public class PickupQueryService {

    public record StopView(Long stopId, int seq, String ownerName, String ownerPhone, Double lat, Double lng, String itemCode,
                           double estKg, boolean done, Double actualKg, Double amountPaid, PaymentStatus paymentStatus) {
    }

    public record PickupView(Long id, Long poolId, LocalDateTime start, LocalDateTime end, PickupStatus status,
                             List<StopView> stops) {
    }

    private final PickupRepository pickups;
    private final PickupStopRepository stops;
    private final ListingLookup listings;
    private final UserDirectory users;

    public PickupQueryService(PickupRepository pickups, PickupStopRepository stops, ListingLookup listings,
                              UserDirectory users) {
        this.pickups = pickups;
        this.stops = stops;
        this.listings = listings;
        this.users = users;
    }

    public PickupView route(long collectorId, long pickupId) {
        Pickup p = pickups.findById(pickupId).orElseThrow(() -> ApiException.notFound("Pickup not found"));
        if (!p.getCollectorId().equals(collectorId)) {
            throw ApiException.forbidden("PICKUP_NOT_YOURS", "This pickup is not yours");
        }
        return view(p);
    }

    public List<PickupView> mine(long collectorId) {
        users.requireCollector(collectorId);
        return pickups.findByCollectorIdOrderByIdDesc(collectorId).stream().map(this::view).toList();
    }

    /** Kilograms already promised to this collector on one day, for the daily capacity check. */
    public double plannedKgOn(long collectorId, java.time.LocalDate date) {
        List<Long> ids = pickups.findByCollectorIdOrderByIdDesc(collectorId).stream()
                .filter(p -> p.getStatus() == PickupStatus.SCHEDULED && p.getScheduledStart().toLocalDate().equals(date))
                .map(Pickup::getId).toList();
        List<Long> listingIds = stops.findByPickupIdIn(ids).stream().map(PickupStop::getListingId).toList();
        return listings.getAll(listingIds).values().stream().mapToDouble(ListingSummary::estKg).sum();
    }

    PickupView view(Pickup p) {
        List<PickupStop> pickupStops = stops.findByPickupIdOrderBySeq(p.getId());
        Map<Long, ListingSummary> byListing = listings.getAll(pickupStops.stream().map(PickupStop::getListingId).toList());
        Map<Long, UserAccount> owners = users.getAll(byListing.values().stream().map(ListingSummary::ownerId).toList());

        List<StopView> views = pickupStops.stream().map(s -> {
            ListingSummary l = byListing.get(s.getListingId());
            UserAccount owner = owners.get(l.ownerId());
            return new StopView(s.getId(), s.getSeq(), owner.name(), owner.phone(), owner.lat(), owner.lng(), l.itemCode(),
                    l.estKg(), s.isDone(), s.getActualKg(), s.getAmountPaid(), s.getPaymentStatus());
        }).toList();
        return new PickupView(p.getId(), p.getPoolId(), p.getScheduledStart(), p.getScheduledEnd(), p.getStatus(),
                views);
    }
}
