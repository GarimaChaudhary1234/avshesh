package com.avshesh.pickup;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.GeoUtil;
import com.avshesh.impact.ImpactMetrics;
import com.avshesh.listing.ListingLookup;
import com.avshesh.listing.ListingSummary;
import com.avshesh.ratecard.Rate;
import com.avshesh.ratecard.RateLookup;
import com.avshesh.scan.Category;
import com.avshesh.user.CollectorProfile;
import com.avshesh.user.Role;
import com.avshesh.user.UserDirectory;

/** Weekly numbers for the collector's earnings screen, counted from fully completed pickups. */
@Service
@Transactional(readOnly = true)
public class EarningsService {

    public record Earnings(int days, int pickups, double kg, double profit, double paidToHouseholds,
                           double compostKg) {
    }

    private final PickupRepository pickups;
    private final PickupStopRepository stops;
    private final ListingLookup listings;
    private final RateLookup rates;
    private final UserDirectory users;
    private final ImpactMetrics metrics;

    public EarningsService(PickupRepository pickups, PickupStopRepository stops, ListingLookup listings,
                           RateLookup rates, UserDirectory users, ImpactMetrics metrics) {
        this.pickups = pickups;
        this.stops = stops;
        this.listings = listings;
        this.rates = rates;
        this.users = users;
        this.metrics = metrics;
    }

    public Earnings earnings(long collectorId, int days) {
        CollectorProfile me = users.requireCollector(collectorId);
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        // Every stop that is done counts as soon as it is done, even if the rest of the route is still to do.
        List<Long> windowIds = pickups.findByCollectorIdOrderByIdDesc(collectorId).stream()
                .filter(p -> p.getScheduledStart().isAfter(since))
                .map(Pickup::getId).toList();

        List<PickupStop> doneStops = stops.findByPickupIdIn(windowIds).stream().filter(PickupStop::isDone).toList();
        int pickupsWorked = (int) doneStops.stream().map(PickupStop::getPickupId).distinct().count();
        Map<Long, ListingSummary> byListing = listings.getAll(doneStops.stream().map(PickupStop::getListingId).toList());

        double kg = 0;
        double profit = 0;
        double paid = 0;
        for (PickupStop s : doneStops) {
            kg += s.getActualKg();
            paid += s.getAmountPaid();
            // the margin written down when the stop was done, not today's rate card
            profit += s.getProfit() == null ? 0 : s.getProfit();
        }
        double compost = me.user().role() == Role.COMPOST ? metrics.compostedKg(Category.WET, kg) : 0;
        return new Earnings(days, pickupsWorked, GeoUtil.round2(kg), GeoUtil.round2(profit),
                GeoUtil.round2(paid), GeoUtil.round2(compost));
    }
}
