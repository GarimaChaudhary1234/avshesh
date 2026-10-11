package com.avshesh.listing;

import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.GeoUtil;
import com.avshesh.impact.ImpactMetrics;
import com.avshesh.pool.PoolQueryService;
import com.avshesh.pool.PoolQueryService.PoolView;
import com.avshesh.user.Role;
import com.avshesh.user.UserAccount;
import com.avshesh.user.UserDirectory;
import com.avshesh.ward.WardDirectory;
import com.avshesh.ward.WardInfo;

/** Numbers for the household home screen: this month's earnings, impact and pool progress. */
@Service
@Transactional(readOnly = true)
public class HomeService {

    /** @param keptFromDumpPercent this month's kilograms kept out of the dump, as a share of what the household is estimated to throw away */
    public record HomeView(WardInfo ward, double earnedThisMonth, double kgSaved, double co2SavedKg,
                           double estimatedWasteKg, double keptFromDumpPercent, List<PoolView> pools) {
    }

    private final ListingRepository listings;
    private final PickupInfoProvider pickupInfo;
    private final PoolQueryService poolQueries;
    private final ImpactMetrics metrics;
    private final UserDirectory users;
    private final WardDirectory wards;
    private final com.avshesh.impact.WasteBaseline baseline;

    public HomeService(ListingRepository listings, PickupInfoProvider pickupInfo, PoolQueryService poolQueries,
                       ImpactMetrics metrics, UserDirectory users, WardDirectory wards,
                       com.avshesh.impact.WasteBaseline baseline) {
        this.baseline = baseline;
        this.listings = listings;
        this.pickupInfo = pickupInfo;
        this.poolQueries = poolQueries;
        this.metrics = metrics;
        this.users = users;
        this.wards = wards;
    }

    public HomeView home(long userId) {
        UserAccount me = users.requireRole(userId, Role.HOUSEHOLD);
        Map<Long, Listing> mine = listings.findByOwnerIdOrderByIdDesc(userId).stream()
                .collect(Collectors.toMap(Listing::getId, l -> l));

        YearMonth thisMonth = YearMonth.now();
        double earned = 0;
        double kg = 0;
        double co2 = 0;
        for (Map.Entry<Long, PickupInfo> e : pickupInfo.forListings(mine.keySet()).entrySet()) {
            PickupInfo info = e.getValue();
            if (info.isDone() && YearMonth.from(info.doneAt()).equals(thisMonth)) {
                earned += info.amountPaid();
                kg += info.actualKg();
                co2 += metrics.co2SavedKg(mine.get(e.getKey()).getCategory(), info.actualKg());
            }
        }
        WardInfo ward = me.wardId() == null ? null : wards.find(me.wardId()).orElse(null);
        // People per household in this ward (4 when the ward is unknown), over the days of the month so far.
        double members = ward != null && ward.population() != null && ward.households() != null && ward.households() > 0
                ? (double) ward.population() / ward.households() : 4.0;
        double estimated = GeoUtil.round2(baseline.estimatedKg(members, java.time.LocalDate.now().getDayOfMonth()));
        return new HomeView(ward, GeoUtil.round2(earned), GeoUtil.round2(kg), GeoUtil.round2(co2),
                estimated, com.avshesh.impact.WasteBaseline.percent(kg, estimated), poolQueries.poolsOfHousehold(userId));
    }
}
