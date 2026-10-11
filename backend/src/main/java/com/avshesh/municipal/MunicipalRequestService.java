package com.avshesh.municipal;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.notification.Notifier;
import com.avshesh.scan.Handling;
import com.avshesh.scan.ItemCatalog;
import com.avshesh.scan.WasteItem;
import com.avshesh.user.Role;
import com.avshesh.user.UserAccount;
import com.avshesh.user.UserDirectory;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Service
public class MunicipalRequestService {

    public record NewRequest(@NotBlank String itemCode,
                             @DecimalMin("0.1") @DecimalMax("200") double estKg,
                             @Size(max = 255) String note) {
    }

    /** @param staffId required when scheduling: the ward staff member who will collect */
    public record StatusUpdate(@NotNull RequestStatus status, LocalDate scheduledFor, Long staffId) {
    }

    /** What the household sees about their own request. */
    public record HouseholdView(Long id, String itemCode, String itemName, double estKg, String note, RequestStatus status,
                                LocalDate scheduledFor, String staffName, LocalDateTime createdAt) {
    }

    /** What the municipal officer sees: who is asking, where, and who is assigned. */
    public record OfficerView(Long id, String householdName, String phone, double lat, double lng,
                              String itemName, double estKg, String note, RequestStatus status,
                              LocalDate scheduledFor, Long staffId, String staffName, String staffPhone,
                              LocalDateTime createdAt) {
    }

    private final MunicipalRequestRepository requests;
    private final UserDirectory users;
    private final ItemCatalog catalog;
    private final Notifier notifier;
    private final MunicipalScope scope;
    private final MunicipalStaffService staff;
    private final ActivityLog activity;

    public MunicipalRequestService(MunicipalRequestRepository requests, UserDirectory users, ItemCatalog catalog,
                                   Notifier notifier, MunicipalScope scope, MunicipalStaffService staff, ActivityLog activity) {
        this.activity = activity;
        this.requests = requests;
        this.users = users;
        this.catalog = catalog;
        this.notifier = notifier;
        this.scope = scope;
        this.staff = staff;
    }

    @Transactional
    public HouseholdView create(long householdId, NewRequest in) {
        UserAccount household = users.requireVerifiedRole(householdId, Role.HOUSEHOLD);
        WasteItem item = catalog.find(in.itemCode()).orElseThrow(() -> ApiException.badRequest("ITEM_UNKNOWN", "Unknown item"));
        if (item.category().handling() != Handling.MUNICIPAL_PICKUP) {
            throw ApiException.badRequest("MUNICIPAL_ONLY_GENERAL", "Only non-recyclable waste can be sent to the municipal corporation");
        }
        MunicipalRequest r = new MunicipalRequest();
        r.setHouseholdId(household.id());
        r.setItemCode(item.code());
        r.setEstKg(in.estKg());
        r.setNote(in.note() == null || in.note().isBlank() ? null : in.note().strip());
        r.setGeohash(household.geohash());
        r.setWardId(household.wardId());
        return householdView(requests.save(r));
    }

    @Transactional(readOnly = true)
    public List<HouseholdView> mine(long householdId) {
        users.requireRole(householdId, Role.HOUSEHOLD);
        return requests.findByHouseholdIdOrderByIdDesc(householdId).stream().map(this::householdView).toList();
    }

    /** The requests of the officer's ward, newest first. A commissioner sees every ward. */
    @Transactional(readOnly = true)
    public List<OfficerView> queue(long officerId) {
        Long ward = scope.wardOf(officerId);
        List<MunicipalRequest> rows = ward == null ? requests.findAllByOrderByIdDesc()
                : requests.findByWardIdOrderByIdDesc(ward);
        Map<Long, UserAccount> owners = users.getAll(rows.stream().map(MunicipalRequest::getHouseholdId).distinct().toList());
        return rows.stream().map(r -> officerView(r, owners.get(r.getHouseholdId()))).toList();
    }

    @Transactional
    public OfficerView update(long officerId, long id, StatusUpdate in) {
        scope.requireWardOfficer(officerId);
        MunicipalRequest r = requests.findById(id).orElseThrow(() -> ApiException.notFound("Request not found"));
        scope.requireAccess(scope.wardOf(officerId), r.getWardId());

        if (in.status() == RequestStatus.SCHEDULED) {
            if (in.scheduledFor() == null || in.scheduledFor().isBefore(LocalDate.now())) {
                throw ApiException.badRequest("MUNICIPAL_DATE", "Choose a pickup date that is today or later");
            }
            if (in.staffId() == null) {
                throw ApiException.badRequest("MUNICIPAL_STAFF_REQUIRED", "Assign a staff member to collect this waste");
            }
            r.setStaffId(staff.requireAssignable(in.staffId(), r.getWardId()).getId());
            r.setScheduledFor(in.scheduledFor());
        }
        r.setStatus(in.status());
        r.setResolvedAt(in.status() == RequestStatus.COLLECTED || in.status() == RequestStatus.REJECTED
                ? LocalDateTime.now() : null);
        requests.save(r);

        MunicipalStaff assigned = staff.find(r.getStaffId());
        switch (in.status()) {
            case SCHEDULED -> notifier.notify(r.getHouseholdId(),
                    assigned == null ? "municipal.scheduled" : "municipal.scheduled.staff",
                    String.valueOf(r.getScheduledFor()), assigned == null ? "" : assigned.getName());
            case COLLECTED -> notifier.notify(r.getHouseholdId(), "municipal.collected");
            case REJECTED -> notifier.notify(r.getHouseholdId(), "municipal.rejected");
            case OPEN -> notifier.notify(r.getHouseholdId(), "municipal.reopened");
        }
        return officerView(r, users.get(r.getHouseholdId()));
    }

    /** One pickup assigned to a collection worker, with what they need to find the house. */
    public record TaskView(Long requestId, String itemCode, String itemName, double estKg, String note,
                           RequestStatus status, LocalDate scheduledFor, String householdName, String householdPhone,
                           double lat, double lng, LocalDateTime doneAt) {
    }

    /** {@code open} are still to do (soonest first); {@code done} are the ones collected in the last 7 days. */
    public record TaskList(List<TaskView> open, List<TaskView> done) {
    }

    @Transactional(readOnly = true)
    public TaskList tasksOf(long staffUserId) {
        MunicipalStaff me = staff.ofUser(staffUserId);
        List<MunicipalRequest> mine = requests.findByStaffIdOrderByScheduledForAsc(me.getId());
        Map<Long, UserAccount> owners = users.getAll(mine.stream().map(MunicipalRequest::getHouseholdId).distinct().toList());
        LocalDateTime weekAgo = LocalDateTime.now().minusDays(7);
        List<TaskView> open = mine.stream().filter(r -> r.getStatus() == RequestStatus.SCHEDULED)
                .map(r -> task(r, owners.get(r.getHouseholdId()))).toList();
        List<TaskView> done = mine.stream()
                .filter(r -> r.getStatus() == RequestStatus.COLLECTED && r.getResolvedAt() != null && r.getResolvedAt().isAfter(weekAgo))
                .sorted((a, b) -> b.getResolvedAt().compareTo(a.getResolvedAt()))
                .map(r -> task(r, owners.get(r.getHouseholdId()))).toList();
        return new TaskList(open, done);
    }

    @Transactional
    public void markCollectedByStaff(long staffUserId, long requestId) {
        MunicipalRequest r = ownTask(staffUserId, requestId);
        r.setStatus(RequestStatus.COLLECTED);
        r.setResolvedAt(LocalDateTime.now());
        requests.save(r);
        notifier.notify(r.getHouseholdId(), "municipal.collected");
        activity.record(staffUserId, r.getWardId(), "REQUEST_COLLECTED", itemName(r));
    }

    /** The worker could not do it: it returns to the officer's queue, unassigned, and the household is told. */
    @Transactional
    public void reportProblemByStaff(long staffUserId, long requestId, String reason) {
        MunicipalRequest r = ownTask(staffUserId, requestId);
        r.setStatus(RequestStatus.OPEN);
        r.setStaffId(null);
        r.setScheduledFor(null);
        r.setResolvedAt(null);
        requests.save(r);
        notifier.notify(r.getHouseholdId(), "municipal.problem");
        activity.record(staffUserId, r.getWardId(), "REQUEST_PROBLEM", itemName(r) + " — " + reason.strip());
    }

    /** A scheduled request assigned to this worker, or 404: a worker cannot touch someone else's pickup. */
    private MunicipalRequest ownTask(long staffUserId, long requestId) {
        MunicipalStaff me = staff.ofUser(staffUserId);
        MunicipalRequest r = requests.findById(requestId).orElse(null);
        if (r == null || !me.getId().equals(r.getStaffId()) || r.getStatus() != RequestStatus.SCHEDULED) {
            throw ApiException.notFound("TASK_NOT_FOUND", "That pickup is not assigned to you");
        }
        return r;
    }

    private TaskView task(MunicipalRequest r, UserAccount owner) {
        return new TaskView(r.getId(), r.getItemCode(), itemName(r), r.getEstKg(), r.getNote(), r.getStatus(),
                r.getScheduledFor(), owner.name(), owner.phone(), owner.lat(), owner.lng(), r.getResolvedAt());
    }

    @Transactional(readOnly = true)
    public long countOpen(Long wardId) {
        return wardId == null ? requests.countByStatus(RequestStatus.OPEN)
                : requests.countByStatusAndWardId(RequestStatus.OPEN, wardId);
    }

    private HouseholdView householdView(MunicipalRequest r) {
        MunicipalStaff assigned = r.getStatus() == RequestStatus.SCHEDULED ? staff.find(r.getStaffId()) : null;
        return new HouseholdView(r.getId(), r.getItemCode(), itemName(r), r.getEstKg(), r.getNote(), r.getStatus(),
                r.getScheduledFor(), assigned == null ? null : assigned.getName(), r.getCreatedAt());
    }

    private OfficerView officerView(MunicipalRequest r, UserAccount owner) {
        MunicipalStaff assigned = staff.find(r.getStaffId());
        return new OfficerView(r.getId(), owner.name(), owner.phone(), owner.lat(), owner.lng(), itemName(r),
                r.getEstKg(), r.getNote(), r.getStatus(), r.getScheduledFor(),
                assigned == null ? null : assigned.getId(), assigned == null ? null : assigned.getName(),
                assigned == null ? null : assigned.getPhone(), r.getCreatedAt());
    }

    private String itemName(MunicipalRequest r) {
        return catalog.find(r.getItemCode()).map(WasteItem::name).orElse(r.getItemCode());
    }
}
