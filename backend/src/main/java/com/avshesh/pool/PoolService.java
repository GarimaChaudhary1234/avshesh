package com.avshesh.pool;

import java.util.Comparator;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.common.GeoUtil;
import com.avshesh.pool.PoolMatcher.Candidate;
import com.avshesh.ward.WardDirectory;

/** Pool lifecycle: joining, re-evaluating, being accepted and finishing. Read-side views live elsewhere. */
@Service
public class PoolService {

    /** The items of a pool that a collector has just taken, so pickup can plan stops from them. */
    public record ReservedPool(Long poolId, List<PoolItem> items) {
    }

    private final PoolRepository pools;
    private final PoolMembership membership;
    private final PoolMatcher matcher;
    private final WardDirectory wards;
    private final double joinRadiusKm;

    public PoolService(PoolRepository pools, PoolMembership membership, PoolMatcher matcher, WardDirectory wards,
                       @Value("${avshesh.pool.join-radius-km:0.4}") double joinRadiusKm) {
        this.pools = pools;
        this.membership = membership;
        this.matcher = matcher;
        this.wards = wards;
        this.joinRadiusKm = joinRadiusKm;
    }

    /** Finds the open pool of this mohalla and waste type, or creates one in the given ward. */
    @Transactional
    public Long assignPool(double lat, double lng, WasteType type, Long wardId) {
        // One queue per waste type: households listing at the same moment either share a pool or start one.
        pools.lockCell(("pool:" + type.name()).hashCode());
        double dLat = joinRadiusKm / 111.0;
        double dLng = joinRadiusKm / (111.0 * Math.cos(Math.toRadians(lat)));
        return pools.findOpenInBox(type, PoolStatus.OPEN, lat - dLat, lat + dLat, lng - dLng, lng + dLng).stream()
                .filter(p -> distanceTo(p, lat, lng) <= joinRadiusKm)
                .min(Comparator.comparingDouble(p -> distanceTo(p, lat, lng)))
                .orElseGet(() -> create(lat, lng, type, wardId)).getId();
    }

    private static double distanceTo(Pool p, double lat, double lng) {
        double[] c = p.center();
        return GeoUtil.distanceKm(c[0], c[1], lat, lng);
    }

    private Pool create(double lat, double lng, WasteType type, Long wardId) {
        Pool p = new Pool();
        p.setGeohash(GeoUtil.geohash(lat, lng));
        p.setCenterLat(lat);
        p.setCenterLng(lng);
        p.setWasteType(type);
        p.setWardId(wardId);
        p.setName("Mohalla Pool");
        p = pools.save(p);
        String where = wardId == null ? "" : wards.find(wardId)
                .map(w -> "Ward " + w.wardNo().replaceFirst("^[A-Za-z]+", "") + " · ").orElse("");
        p.setName(where + (type == WasteType.WET ? "Wet" : "Dry") + " Pool #" + p.getId());
        return pools.save(p);
    }

    /** Recomputes weight, best profit and READY/FILLING. Accepted or finished pools are left alone. */
    @Transactional
    public void refresh(Long poolId) {
        Pool pool = pools.findById(poolId).orElseThrow(() -> ApiException.notFound("Pool not found"));
        List<PoolItem> items = membership.itemsInPool(poolId);
        double[] at = pool.center();
        List<Candidate> candidates = matcher.candidates(at[0], at[1], pool.getWasteType(), items);

        pool.setTotalKg(GeoUtil.round2(PoolItem.totalKg(items)));
        double best = candidates.stream().mapToDouble(Candidate::profit).max().orElse(0);
        pool.setEstProfit(GeoUtil.round2(Math.max(0, best)));
        if (PoolStatus.OPEN.contains(pool.getStatus())) {
            pool.setStatus(candidates.stream().anyMatch(Candidate::ready) ? PoolStatus.READY : PoolStatus.FILLING);
        }
        pools.save(pool);
    }

    /** A collector takes a READY pool. Locks the row so two collectors cannot both get it. */
    @Transactional
    public ReservedPool reserve(long collectorId, Long poolId) {
        Pool pool = pools.lockById(poolId).orElseThrow(() -> ApiException.notFound("Pool not found"));
        // The stored status can lag behind (it is only refreshed when a listing joins), so the pool is judged by
        // whether it is still open and this dealer could profit from it right now.
        if (!PoolStatus.OPEN.contains(pool.getStatus())) {
            throw ApiException.conflict("POOL_UNAVAILABLE", "This pool is no longer available: another collector has taken it");
        }
        List<PoolItem> items = membership.itemsInPool(poolId);
        double[] at = pool.center();
        boolean eligible = matcher.candidates(at[0], at[1], pool.getWasteType(), items).stream()
                .anyMatch(c -> c.ready() && c.collector().user().id().equals(collectorId));
        if (!eligible) {
            throw ApiException.conflict("POOL_NOT_ELIGIBLE", "This pool does not meet your rate card, capacity and minimum trip profit");
        }
        pool.setStatus(PoolStatus.ACCEPTED);
        pool.setCollectorId(collectorId);
        pools.save(pool);
        return new ReservedPool(poolId, items);
    }

    @Transactional
    public void markDone(Long poolId) {
        pools.findById(poolId).ifPresent(p -> {
            p.setStatus(PoolStatus.DONE);
            pools.save(p);
        });
    }
}
