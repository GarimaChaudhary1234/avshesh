package com.avshesh.municipal;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.impact.ImpactReader;
import com.avshesh.impact.ImpactView;
import com.avshesh.pool.PoolQueryService;
import com.avshesh.pool.PoolStatus;
import com.avshesh.rating.RatingLookup;
import com.avshesh.rating.RatingSummary;
import com.avshesh.user.CollectorProfile;
import com.avshesh.user.CollectorVerifier;
import com.avshesh.user.Role;
import com.avshesh.user.UserDirectory;
import com.avshesh.user.VehicleType;
import com.avshesh.user.VerificationStatus;
import com.avshesh.ward.WardDirectory;
import com.avshesh.ward.WardInfo;

/** What a municipal officer sees for their ward (or the whole city for a commissioner). */
@Service
public class MunicipalOverviewService {

    /** @param ward the officer's ward, or null for a city-wide commissioner */
    public record Overview(WardInfo ward, ImpactView impact, long households, long verifiedCollectors,
                           long pendingCollectors, Map<PoolStatus, Long> poolsByStatus, long openRequests,
                           long openedCollectionPoints, long openDisputes) {
    }

    public record CollectorRow(Long id, Role role, String name, String businessName, String phone, String address,
                               VehicleType vehicleType, String workingHours, double serviceRadiusKm,
                               boolean acceptingPickups, VerificationStatus verification, Double rating,
                               int ratingCount) {
    }

    private final ImpactReader impact;
    private final UserDirectory users;
    private final PoolQueryService pools;
    private final MunicipalRequestService requests;
    private final CollectionPointService points;
    private final CollectorVerifier verifier;
    private final WardDirectory wards;
    private final RatingLookup ratings;
    private final MunicipalScope scope;
    private final MunicipalDisputeService disputes;

    public MunicipalOverviewService(ImpactReader impact, UserDirectory users, PoolQueryService pools,
                                    MunicipalRequestService requests, CollectionPointService points,
                                    CollectorVerifier verifier, WardDirectory wards, RatingLookup ratings,
                                    MunicipalScope scope, MunicipalDisputeService disputes) {
        this.impact = impact;
        this.users = users;
        this.pools = pools;
        this.requests = requests;
        this.points = points;
        this.verifier = verifier;
        this.wards = wards;
        this.ratings = ratings;
        this.scope = scope;
        this.disputes = disputes;
    }

    @Transactional(readOnly = true)
    public Overview overview(long officerId) {
        Long ward = scope.wardOf(officerId);
        List<CollectorProfile> collectors = users.allCollectors(ward);
        long verified = collectors.stream().filter(c -> c.verification() == VerificationStatus.VERIFIED).count();
        long pending = collectors.stream().filter(c -> c.verification() == VerificationStatus.PENDING).count();
        return new Overview(ward == null ? null : wards.find(ward).orElse(null), impact.summaryForWard(ward),
                users.countByRole(ward).getOrDefault(Role.HOUSEHOLD, 0L), verified, pending,
                pools.countByStatus(ward), requests.countOpen(ward), points.countActive(ward), disputes.countOpen(ward));
    }

    @Transactional(readOnly = true)
    public List<CollectorRow> collectors(long officerId) {
        return collectorsOf(scope.wardOf(officerId));
    }

    /** Dealers and compost centers located in one ward, or in the whole city when {@code ward} is null. */
    @Transactional(readOnly = true)
    public List<CollectorRow> collectorsOf(Long ward) {
        List<CollectorProfile> list = users.allCollectors(ward);
        Map<Long, RatingSummary> stars = ratings.forCollectors(list.stream().map(c -> c.user().id()).toList());
        return list.stream()
                .sorted((a, b) -> a.verification().compareTo(b.verification()))
                .map(c -> {
                    RatingSummary r = stars.getOrDefault(c.user().id(), RatingSummary.NONE);
                    return new CollectorRow(c.user().id(), c.user().role(), c.user().name(), c.businessName(),
                            c.user().phone(), c.address(), c.vehicleType(), c.workingHours(), c.serviceRadiusKm(),
                            c.acceptingPickups(), c.verification(), r.count() == 0 ? null : r.average(), r.count());
                })
                .toList();
    }

    @Transactional
    public void setVerification(long officerId, long collectorId, VerificationStatus status) {
        CollectorProfile c = users.findCollector(collectorId)
                .orElseThrow(() -> ApiException.notFound("Collector not found"));
        scope.requireAccess(scope.wardOf(officerId), c.user().wardId());
        verifier.setStatus(collectorId, status);
    }
}
