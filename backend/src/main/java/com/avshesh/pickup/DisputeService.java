package com.avshesh.pickup;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.listing.ListingLookup;
import com.avshesh.listing.ListingSummary;
import com.avshesh.municipal.PaymentDisputes;
import com.avshesh.notification.Notifier;
import com.avshesh.user.UserAccount;
import com.avshesh.user.UserDirectory;

/** The pickup module's answer to the municipal corporation's question "which payments are in dispute?". */
@Service
public class DisputeService implements PaymentDisputes {

    private static final int LIMIT = 100;

    private final PickupStopRepository stops;
    private final PickupRepository pickups;
    private final ListingLookup listings;
    private final UserDirectory users;
    private final Notifier notifier;

    public DisputeService(PickupStopRepository stops, PickupRepository pickups, ListingLookup listings,
                          UserDirectory users, Notifier notifier) {
        this.stops = stops;
        this.pickups = pickups;
        this.listings = listings;
        this.users = users;
        this.notifier = notifier;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Dispute> recent() {
        List<PickupStop> rows = stops.findByPaymentStatusInOrderByIdDesc(
                Set.of(PaymentStatus.DISPUTED, PaymentStatus.RESOLVED));
        return view(rows.stream()
                .sorted(Comparator.comparing((PickupStop s) -> s.getPaymentStatus() == PaymentStatus.DISPUTED ? 0 : 1)
                        .thenComparing(PickupStop::getId, Comparator.reverseOrder()))
                .limit(LIMIT).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Dispute get(long stopId) {
        PickupStop s = stops.findById(stopId).orElseThrow(() -> ApiException.notFound("Stop not found"));
        if (s.getPaymentStatus() != PaymentStatus.DISPUTED && s.getPaymentStatus() != PaymentStatus.RESOLVED) {
            throw ApiException.notFound("DISPUTE_NOT_FOUND", "There is no dispute for this stop");
        }
        return view(List.of(s)).get(0);
    }

    @Override
    @Transactional
    public Dispute resolve(long stopId, String resolutionNote) {
        PickupStop s = stops.findById(stopId).orElseThrow(() -> ApiException.notFound("Stop not found"));
        if (s.getPaymentStatus() != PaymentStatus.DISPUTED) {
            throw ApiException.conflict("DISPUTE_NOT_OPEN", "This dispute is not open");
        }
        s.setPaymentStatus(PaymentStatus.RESOLVED);
        s.setResolutionNote(resolutionNote);
        s.setResolvedAt(LocalDateTime.now());
        stops.save(s);

        ListingSummary listing = listings.get(s.getListingId());
        Long dealerId = pickups.findById(s.getPickupId()).orElseThrow().getCollectorId();
        notifier.notify(listing.ownerId(), "payment.dispute.resolved", resolutionNote);
        notifier.notify(dealerId, "payment.dispute.resolved", resolutionNote);
        return view(List.of(s)).get(0);
    }

    private List<Dispute> view(List<PickupStop> rows) {
        Map<Long, ListingSummary> byListing = listings.getAll(rows.stream().map(PickupStop::getListingId).toList());
        Map<Long, Pickup> byPickup = pickups.findAllById(rows.stream().map(PickupStop::getPickupId).distinct().toList())
                .stream().collect(Collectors.toMap(Pickup::getId, p -> p));
        Map<Long, UserAccount> people = users.getAll(
                java.util.stream.Stream.concat(
                        byListing.values().stream().map(ListingSummary::ownerId),
                        byPickup.values().stream().map(Pickup::getCollectorId)).distinct().toList());
        return rows.stream().map(s -> {
            ListingSummary l = byListing.get(s.getListingId());
            UserAccount household = people.get(l.ownerId());
            UserAccount dealer = people.get(byPickup.get(s.getPickupId()).getCollectorId());
            return new Dispute(s.getId(), household.wardId(), household.name(), household.phone(), dealer.name(),
                    dealer.phone(), l.itemCode(), s.getActualKg(), s.getAmountPaid(),
                    s.getPaymentMode() == null ? null : s.getPaymentMode().name(), s.getDisputeNote(),
                    s.getPaymentStatus().name(), s.getResolutionNote(), s.getConfirmedAt());
        }).toList();
    }
}
