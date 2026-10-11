package com.avshesh.pickup;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.common.GeoUtil;
import com.avshesh.impact.ImpactRecorder;
import com.avshesh.listing.ListingLifecycle;
import com.avshesh.listing.ListingLookup;
import com.avshesh.listing.ListingSummary;
import com.avshesh.notification.Notifier;
import com.avshesh.pool.PoolService;
import com.avshesh.ratecard.Rate;
import com.avshesh.ratecard.RateLookup;
import com.avshesh.user.UserAccount;
import com.avshesh.user.UserDirectory;

/** At the door: the collector enters the real weight and pays; the household confirms the payment afterwards. */
@Service
public class StopCompletionService {

    public record StopResult(double actualKg, double rate, double amount, String message, boolean pickupDone) {
    }

    private final PickupRepository pickups;
    private final PickupStopRepository stops;
    private final ListingLookup listingLookup;
    private final ListingLifecycle listingLifecycle;
    private final UserDirectory users;
    private final RateLookup rates;
    private final PoolService pools;
    private final ImpactRecorder impact;
    private final Notifier notifier;

    /** Nobody collects more than this from one home in one stop. */
    private static final double MAX_STOP_KG = 1000;

    public StopCompletionService(PickupRepository pickups, PickupStopRepository stops, ListingLookup listingLookup,
                                 ListingLifecycle listingLifecycle, UserDirectory users, RateLookup rates,
                                 PoolService pools, ImpactRecorder impact, Notifier notifier) {
        this.pickups = pickups;
        this.stops = stops;
        this.listingLookup = listingLookup;
        this.listingLifecycle = listingLifecycle;
        this.users = users;
        this.rates = rates;
        this.pools = pools;
        this.impact = impact;
        this.notifier = notifier;
    }

    @Transactional
    public StopResult complete(long collectorId, long stopId, double actualKg, PaymentMode mode) {
        if (actualKg <= 0) {
            throw ApiException.badRequest("WEIGHT_POSITIVE", "Weight must be more than 0");
        }
        PickupStop stop = stops.findById(stopId).orElseThrow(() -> ApiException.notFound("Stop not found"));
        Pickup pickup = pickups.findById(stop.getPickupId()).orElseThrow();
        if (!pickup.getCollectorId().equals(collectorId)) {
            throw ApiException.forbidden("PICKUP_NOT_YOURS", "This pickup is not yours");
        }
        if (stop.isDone()) {
            throw ApiException.conflict("STOP_DONE", "This stop is already completed");
        }

        ListingSummary listing = listingLookup.get(stop.getListingId());
        // A typo such as 5000 instead of 5.0 would record a huge payment: weights are checked against the listing.
        double allowed = Math.min(MAX_STOP_KG, Math.max(listing.estKg() * 3, listing.estKg() + 10));
        if (actualKg > allowed) {
            throw ApiException.badRequest("WEIGHT_TOO_HIGH",
                    "A weight of {0} kg is far more than the {1} kg listed. Please check the scale.",
                    String.valueOf(actualKg), String.valueOf(listing.estKg()));
        }
        UserAccount owner = users.get(listing.ownerId());
        Rate rate = rates.ratesOf(collectorId).get(listing.itemCode());
        double pricePerKg = rate != null ? rate.buyRate() : 0;
        double amount = GeoUtil.round2(actualKg * pricePerKg);

        stop.setActualKg(actualKg);
        stop.setAmountPaid(amount);
        stop.setBuyRate(pricePerKg);
        stop.setSellRate(rate == null ? 0.0 : rate.sellRate());
        stop.setProfit(rate == null ? 0.0 : GeoUtil.round2(actualKg * rate.margin()));
        stop.setPaymentMode(mode);
        stop.setDoneAt(LocalDateTime.now());
        stops.save(stop);
        listingLifecycle.markDone(listing.id());
        impact.record(owner.geohash(), owner.wardId(), listing.category(), actualKg, amount, stop.getId(), pickup.getId());

        String message = actualKg + " kg x Rs " + pricePerKg + " = Rs " + amount + " received";
        notifier.notify(owner.id(), "payment.received", String.valueOf(actualKg), String.valueOf(pricePerKg),
                String.valueOf(amount));

        boolean allDone = stops.findByPickupIdOrderBySeq(pickup.getId()).stream().allMatch(PickupStop::isDone);
        if (allDone) {
            pickup.setStatus(PickupStatus.DONE);
            pickups.save(pickup);
            pools.markDone(pickup.getPoolId());
        }
        return new StopResult(actualKg, pricePerKg, amount, message, allDone);
    }

}
