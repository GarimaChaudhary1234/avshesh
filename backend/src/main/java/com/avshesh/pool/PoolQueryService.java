package com.avshesh.pool;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.GeoUtil;
import com.avshesh.ratecard.Rate;
import com.avshesh.ratecard.RateLookup;
import com.avshesh.pool.PoolMatcher.Candidate;
import com.avshesh.user.CollectorProfile;
import com.avshesh.user.UserDirectory;

/** Read-only pool views for the household home screen and the collector dashboard. */
@Service
@Transactional(readOnly = true)
public class PoolQueryService {

    /** Shown as the pool target while no collector serves the area yet. */
    private static final double DEFAULT_TARGET = 200;

    /**
     * One kind of waste inside a pool. {@code buyRate} and {@code margin} are the viewing collector's own numbers and
     * are null for a household or for an item the collector does not buy.
     */
    public record ItemLine(String itemCode, double kg, int households, Double buyRate, Double margin) {
    }

    public record PoolView(Long id, String name, WasteType wasteType, PoolStatus status, double totalKg,
                           int households, double currentValue, double target, int percent, Double kgNeeded,
                           List<ItemLine> items) {
    }

    public record CollectorPoolRow(Long poolId, String name, WasteType wasteType, PoolStatus status,
                                   double distanceKm, double totalKg, int households, double profit,
                                   double profitPerKm, boolean ready, boolean tooHeavy, double capacityKg,
                                   boolean inRange, double serviceRadiusKm, int percent, double target, Double kgNeeded,
                                   List<ItemLine> items) {
    }

    private final PoolRepository pools;
    private final PoolMembership membership;
    private final PoolMatcher matcher;
    private final UserDirectory users;
    private final RateLookup rates;

    public PoolQueryService(PoolRepository pools, PoolMembership membership, PoolMatcher matcher,
                            UserDirectory users, RateLookup rates) {
        this.rates = rates;
        this.pools = pools;
        this.membership = membership;
        this.matcher = matcher;
        this.users = users;
    }

    /** Pools this household has put listings into that are not finished. */
    public List<PoolView> poolsOfHousehold(long ownerId) {
        return pools.findAllById(membership.poolIdsOfOwner(ownerId)).stream()
                .filter(p -> p.getStatus() != PoolStatus.DONE)
                .map(this::view).toList();
    }

    private PoolView view(Pool pool) {
        List<PoolItem> items = membership.itemsInPool(pool.getId());
        double[] at = pool.center();
        List<Candidate> candidates = matcher.candidates(at[0], at[1], pool.getWasteType(), items);
        double kg = PoolItem.totalKg(items);

        Optional<Candidate> best = candidates.stream().max(Comparator.comparingDouble(Candidate::profit));
        double value = Math.max(0, best.map(Candidate::profit).orElse(0.0));
        double target = best.map(c -> c.collector().minTripProfit()).orElse(DEFAULT_TARGET);
        int percent = target <= 0 ? 100 : (int) Math.min(100, Math.round(value / target * 100));

        Double kgNeeded = null;
        if (value >= target) {
            kgNeeded = 0.0;
        } else if (value > 0 && kg > 0) {
            kgNeeded = GeoUtil.round2((target - value) / (value / kg));
        }
        // The stored status can be out of date (a dealer paused or was rejected after the pool filled up),
        // so an open pool is shown as READY only if some dealer could accept it right now.
        PoolStatus status = PoolStatus.OPEN.contains(pool.getStatus())
                ? (candidates.stream().anyMatch(Candidate::ready) ? PoolStatus.READY : PoolStatus.FILLING)
                : pool.getStatus();
        return new PoolView(pool.getId(), pool.getName(), pool.getWasteType(), status,
                GeoUtil.round2(kg), PoolItem.households(items), GeoUtil.round2(value), target, percent, kgNeeded,
                lines(items, null));
    }

    /** What is inside the pool, one line per kind of waste, the biggest first. */
    private static List<ItemLine> lines(List<PoolItem> items, Map<String, Rate> rates) {
        Map<String, List<PoolItem>> byItem = new LinkedHashMap<>();
        for (PoolItem item : items) {
            byItem.computeIfAbsent(item.itemCode(), k -> new ArrayList<>()).add(item);
        }
        return byItem.entrySet().stream().map(e -> {
            double kg = PoolItem.totalKg(e.getValue());
            Rate rate = rates == null ? null : rates.get(e.getKey());
            return new ItemLine(e.getKey(), GeoUtil.round2(kg), PoolItem.households(e.getValue()),
                    rate == null ? null : rate.buyRate(), rate == null ? null : GeoUtil.round2(kg * rate.margin()));
        }).sorted(Comparator.comparingDouble(ItemLine::kg).reversed()).toList();
    }

    /** Number of pools in each state, for the municipal dashboard. A null ward means the whole city. */
    public Map<PoolStatus, Long> countByStatus(Long wardId) {
        Map<PoolStatus, Long> counts = new EnumMap<>(PoolStatus.class);
        for (PoolStatus s : PoolStatus.values()) {
            counts.put(s, wardId == null ? pools.countByStatus(s) : pools.countByStatusAndWardId(s, wardId));
        }
        return counts;
    }

    /** Most pools shown at once. */
    private static final int MAX_POOLS_SHOWN = 100;

    /**
     * Every open pool of the collector's waste type, so they can compare and decide. Order: pools they can accept
     * now (best profit per km first), then the other pools in their area, then pools outside their service area
     * (nearest first). Only pools outside the area or without profit are flagged: nothing is hidden.
     */
    public List<CollectorPoolRow> poolsForCollector(long collectorId) {
        CollectorProfile me = users.requireCollector(collectorId);
        if (!me.canWork()) {
            return List.of();
        }
        WasteType type = WasteType.servedBy(me.user().role());

        List<CollectorPoolRow> rows = new ArrayList<>();
        Map<String, Rate> myRates = rates.ratesOf(collectorId);
        for (Pool p : pools.findByWasteTypeAndStatusIn(type, PoolStatus.OPEN)) {
            List<PoolItem> items = membership.itemsInPool(p.getId());
            double[] at = p.center();
            Candidate c = matcher.assessAnywhere(me, at[0], at[1], items);
            double kg = PoolItem.totalKg(items);
            double target = me.minTripProfit();
            double value = Math.max(0, c.profit());
            int percent = target <= 0 ? 100 : (int) Math.min(100, Math.round(value / target * 100));
            Double kgNeeded = value >= target ? Double.valueOf(0) : (value > 0 && kg > 0 ? GeoUtil.round2((target - value) / (value / kg)) : null);
            rows.add(new CollectorPoolRow(p.getId(), p.getName(), p.getWasteType(), p.getStatus(),
                    GeoUtil.round2(c.distanceKm()), GeoUtil.round2(PoolItem.totalKg(items)),
                    PoolItem.households(items), GeoUtil.round2(c.profit()),
                    GeoUtil.round2(c.profit() / Math.max(c.distanceKm(), 0.5)), c.ready(), c.tooHeavy(),
                    me.vehicleCapacityKg(), c.inRange(), me.serviceRadiusKm(), percent, target, kgNeeded,
                    lines(items, myRates)));
        }
        rows.sort(Comparator.comparing(CollectorPoolRow::ready).reversed()
                .thenComparing(Comparator.comparing(CollectorPoolRow::inRange).reversed())
                .thenComparing(r -> r.inRange() ? -r.profitPerKm() : r.distanceKm()));
        return rows.size() > MAX_POOLS_SHOWN ? rows.subList(0, MAX_POOLS_SHOWN) : rows;
    }
}
