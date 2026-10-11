package com.avshesh.pool;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Component;

import com.avshesh.common.GeoUtil;
import com.avshesh.ratecard.RateLookup;
import com.avshesh.user.CollectorProfile;
import com.avshesh.user.UserDirectory;

/** Works out which collectors a pool is interesting to, and how much they would make. */
@Component
public class PoolMatcher {

    /** How one collector sees one pool. {@code ready} means they would actually accept it. */
    public record Candidate(CollectorProfile collector, double distanceKm, double profit, boolean ready,
                            boolean tooHeavy, boolean inRange) {
    }

    private final UserDirectory users;
    private final RateLookup rates;
    private final ProfitPolicy profitPolicy;
    private final CapacityPolicy capacityPolicy;

    public PoolMatcher(UserDirectory users, RateLookup rates, ProfitPolicy profitPolicy, CapacityPolicy capacityPolicy) {
        this.users = users;
        this.rates = rates;
        this.profitPolicy = profitPolicy;
        this.capacityPolicy = capacityPolicy;
    }

    /** Every collector of the right kind whose service area covers the pool. */
    public List<Candidate> candidates(double lat, double lng, WasteType type, List<PoolItem> items) {
        return users.collectorsByRole(type.collectorRole()).stream()
                .map(c -> assess(c, lat, lng, items))
                .flatMap(Optional::stream)
                .toList();
    }

    /** Empty when the pool is outside this collector's service area. */
    public Optional<Candidate> assess(CollectorProfile collector, double lat, double lng, List<PoolItem> items) {
        Candidate c = assessAnywhere(collector, lat, lng, items);
        return c.inRange() ? Optional.of(c) : Optional.empty();
    }

    /**
     * The same assessment for a pool anywhere, so a collector can still SEE pools outside their service area and
     * decide whether to widen it. Such a pool is never ready: a collector only accepts pools inside their own radius.
     */
    public Candidate assessAnywhere(CollectorProfile collector, double lat, double lng, List<PoolItem> items) {
        double km = GeoUtil.distanceKm(collector.user().lat(), collector.user().lng(), lat, lng);
        boolean inRange = km <= collector.serviceRadiusKm();
        double profit = profitPolicy.profit(items, rates.ratesOf(collector.user().id()), km, collector.costPerKm());
        double kg = PoolItem.totalKg(items);
        boolean tooHeavy = !capacityPolicy.fits(collector, kg);
        boolean ready = inRange && profit >= collector.minTripProfit() && kg >= collector.minLoadKg() && !tooHeavy;
        return new Candidate(collector, km, profit, ready, tooHeavy, inRange);
    }
}
