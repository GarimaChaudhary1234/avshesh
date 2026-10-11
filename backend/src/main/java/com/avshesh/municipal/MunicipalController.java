package com.avshesh.municipal;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.avshesh.municipal.CollectionPointService.PointInput;
import com.avshesh.municipal.CollectionPointService.PointView;
import com.avshesh.municipal.MunicipalOverviewService.CollectorRow;
import com.avshesh.municipal.MunicipalOverviewService.Overview;
import com.avshesh.municipal.MunicipalRequestService.OfficerView;
import com.avshesh.municipal.MunicipalRequestService.StatusUpdate;
import com.avshesh.municipal.MunicipalStaffService.StaffInput;
import com.avshesh.municipal.MunicipalStaffService.StaffView;
import com.avshesh.security.CurrentUserId;
import com.avshesh.security.MunicipalOnly;
import com.avshesh.user.VerificationStatus;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Everything a municipal officer can see and change, limited to their own ward. */
@RestController
@RequestMapping("/api/v1/municipal")
@MunicipalOnly
public class MunicipalController {

    public record VerificationRequest(@NotNull VerificationStatus status) {
    }

    public record ActiveRequest(boolean active) {
    }

    public record ResolveRequest(@NotBlank @Size(max = 255) String note) {
    }

    private final MunicipalOverviewService overview;
    private final MunicipalRequestService requests;
    private final CollectionPointService points;
    private final MunicipalStaffService staff;
    private final MunicipalDisputeService disputes;
    private final ActivityLog log;
    private final MunicipalScope scope;

    public MunicipalController(MunicipalOverviewService overview, MunicipalRequestService requests,
                               CollectionPointService points, MunicipalStaffService staff,
                               MunicipalDisputeService disputes, ActivityLog log, MunicipalScope scope) {
        this.log = log;
        this.scope = scope;
        this.overview = overview;
        this.requests = requests;
        this.points = points;
        this.staff = staff;
        this.disputes = disputes;
    }

    @GetMapping("/overview")
    public Overview overview(@CurrentUserId Long officerId) {
        return overview.overview(officerId);
    }

    @GetMapping("/requests")
    public List<OfficerView> requests(@CurrentUserId Long officerId) {
        return requests.queue(officerId);
    }

    @PutMapping("/requests/{id}")
    public OfficerView updateRequest(@CurrentUserId Long officerId, @PathVariable long id,
                                     @Valid @RequestBody StatusUpdate body) {
        OfficerView view = requests.update(officerId, id, body);
        log.record(officerId, scope.wardOf(officerId), "REQUEST_" + view.status(),
                view.itemName() + (view.staffName() != null && view.status() == com.avshesh.municipal.RequestStatus.SCHEDULED ? " → " + view.staffName() : ""));
        return view;
    }

    @GetMapping("/staff")
    public List<StaffView> staff(@CurrentUserId Long officerId) {
        return staff.list(officerId);
    }

    @PostMapping("/staff")
    public StaffView createStaff(@CurrentUserId Long officerId, @Valid @RequestBody StaffInput body) {
        StaffView created = staff.create(officerId, body);
        log.record(officerId, created.wardId(), "STAFF_ADDED", created.name());
        return created;
    }

    @PutMapping("/staff/{id}")
    public StaffView setStaffActive(@CurrentUserId Long officerId, @PathVariable long id,
                                    @RequestBody ActiveRequest body) {
        StaffView changed = staff.setActive(officerId, id, body.active());
        log.record(officerId, changed.wardId(), changed.active() ? "STAFF_ENABLED" : "STAFF_DISABLED", changed.name());
        return changed;
    }

    @GetMapping("/collection-points")
    public List<PointView> points(@CurrentUserId Long officerId) {
        return points.all(officerId);
    }

    @PostMapping("/collection-points")
    public PointView createPoint(@CurrentUserId Long officerId, @Valid @RequestBody PointInput body) {
        PointView created = points.create(officerId, body);
        log.record(officerId, scope.wardOf(officerId), "POINT_ADDED", created.name());
        return created;
    }

    @PutMapping("/collection-points/{id}")
    public PointView updatePoint(@CurrentUserId Long officerId, @PathVariable long id,
                                 @Valid @RequestBody PointInput body) {
        PointView changed = points.update(officerId, id, body);
        log.record(officerId, scope.wardOf(officerId), "POINT_UPDATED", changed.name());
        return changed;
    }

    @GetMapping("/disputes")
    public List<PaymentDisputes.Dispute> disputes(@CurrentUserId Long officerId) {
        return disputes.list(officerId);
    }

    @PostMapping("/disputes/{stopId}/resolve")
    public PaymentDisputes.Dispute resolveDispute(@CurrentUserId Long officerId, @PathVariable long stopId,
                                                  @Valid @RequestBody ResolveRequest body) {
        PaymentDisputes.Dispute resolved = disputes.resolve(officerId, stopId, body.note());
        log.record(officerId, resolved.wardId(), "DISPUTE_RESOLVED", resolved.itemCode() + " · " + resolved.householdName());
        return resolved;
    }

    @GetMapping("/collectors")
    public List<CollectorRow> collectors(@CurrentUserId Long officerId) {
        return overview.collectors(officerId);
    }

    @PostMapping("/collectors/{id}/verification")
    public List<CollectorRow> verify(@CurrentUserId Long officerId, @PathVariable long id,
                                     @Valid @RequestBody VerificationRequest body) {
        overview.setVerification(officerId, id, body.status());
        List<CollectorRow> rows = overview.collectors(officerId);
        rows.stream().filter(r -> r.id().equals(id)).findFirst().ifPresent(r -> log.record(officerId,
                scope.wardOf(officerId), "DEALER_" + body.status(), r.businessName() != null ? r.businessName() : r.name()));
        return rows;
    }
}
