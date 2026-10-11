package com.avshesh.municipal;

import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.common.GeoUtil;
import com.avshesh.user.Role;
import com.avshesh.user.UserAccount;
import com.avshesh.user.UserDirectory;
import com.avshesh.ward.WardLocator;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Service
public class CollectionPointService {

    private static final int NEARBY_LIMIT = 5;

    public record PointInput(@NotBlank @Size(max = 120) String name,
                             @NotBlank @Size(max = 255) String address,
                             @DecimalMin("-90") @DecimalMax("90") double lat,
                             @DecimalMin("-180") @DecimalMax("180") double lng,
                             @NotBlank @Size(max = 255) String accepts,
                             @Size(max = 80) String openingHours,
                             boolean active) {
    }

    public record PointView(Long id, String name, String address, double lat, double lng, String accepts,
                            String openingHours, boolean active, Double distanceKm) {
    }

    private final CollectionPointRepository points;
    private final UserDirectory users;
    private final WardLocator wards;
    private final MunicipalScope scope;

    public CollectionPointService(CollectionPointRepository points, UserDirectory users, WardLocator wards,
                                  MunicipalScope scope) {
        this.points = points;
        this.users = users;
        this.wards = wards;
        this.scope = scope;
    }

    /** Active drop-off points closest to this household, nearest first. */
    @Transactional(readOnly = true)
    public List<PointView> nearby(long householdId) {
        UserAccount me = users.requireRole(householdId, Role.HOUSEHOLD);
        return points.findByActiveTrue().stream()
                .map(p -> view(p, GeoUtil.round2(GeoUtil.distanceKm(me.lat(), me.lng(), p.getLat(), p.getLng()))))
                .sorted(Comparator.comparingDouble(PointView::distanceKm))
                .limit(NEARBY_LIMIT)
                .toList();
    }

    /** The drop-off points of the officer's ward. A commissioner sees every ward. */
    @Transactional(readOnly = true)
    public List<PointView> all(long officerId) {
        Long ward = scope.wardOf(officerId);
        List<CollectionPoint> rows = ward == null ? points.findAllByOrderByIdDesc() : points.findByWardIdOrderByIdDesc(ward);
        return rows.stream().map(p -> view(p, null)).toList();
    }

    @Transactional
    public PointView create(long officerId, PointInput in) {
        Long ward = scope.wardOf(officerId);
        CollectionPoint p = apply(new CollectionPoint(), in, ward);
        return view(points.save(p), null);
    }

    @Transactional
    public PointView update(long officerId, long id, PointInput in) {
        Long ward = scope.wardOf(officerId);
        CollectionPoint p = points.findById(id).orElseThrow(() -> ApiException.notFound("Collection point not found"));
        scope.requireAccess(ward, p.getWardId());
        return view(points.save(apply(p, in, ward)), null);
    }

    /** The point's ward comes from its location; a ward officer cannot add a point outside their ward. */
    private CollectionPoint apply(CollectionPoint p, PointInput in, Long officerWard) {
        Long pointWard = wards.wardIdAt(in.lat(), in.lng()).orElse(null);
        if (officerWard != null && !officerWard.equals(pointWard)) {
            throw ApiException.badRequest("POINT_OUTSIDE_WARD", "This location is outside your ward");
        }
        p.setName(in.name().strip());
        p.setAddress(in.address().strip());
        p.setLat(in.lat());
        p.setLng(in.lng());
        p.setAccepts(in.accepts().strip());
        p.setOpeningHours(in.openingHours() == null || in.openingHours().isBlank() ? null : in.openingHours().strip());
        p.setActive(in.active());
        p.setWardId(pointWard);
        return p;
    }

    @Transactional(readOnly = true)
    public long countActive(Long wardId) {
        return wardId == null ? points.findByActiveTrue().size() : points.countByActiveTrueAndWardId(wardId);
    }

    private static PointView view(CollectionPoint p, Double distanceKm) {
        return new PointView(p.getId(), p.getName(), p.getAddress(), p.getLat(), p.getLng(), p.getAccepts(),
                p.getOpeningHours(), p.isActive(), distanceKm);
    }
}
