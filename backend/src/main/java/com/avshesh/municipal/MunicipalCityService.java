package com.avshesh.municipal;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.impact.ImpactReader;
import com.avshesh.impact.ImpactView;
import com.avshesh.municipal.MunicipalOverviewService.CollectorRow;
import com.avshesh.municipal.MunicipalStaffService.StaffView;
import com.avshesh.user.CollectorProfile;
import com.avshesh.user.OfficerDirectory;
import com.avshesh.user.OfficerDirectory.Officer;
import com.avshesh.user.Role;
import com.avshesh.user.UserDirectory;
import com.avshesh.user.VerificationStatus;
import com.avshesh.ward.WardDirectory;
import com.avshesh.ward.WardInfo;

/**
 * The commissioner's view of the whole city: every ward side by side, one ward in depth, and the ward officers.
 * All of it is read-only except the officer management, which sits in {@link CityController}.
 */
@Service
public class MunicipalCityService {

    public record OfficerBrief(Long id, String name, String phone, boolean active) {
    }

    public record WardRow(WardInfo ward, List<OfficerBrief> officers, long registeredHouseholds, long dealers,
                          long verifiedDealers, long pendingDealers, long openRequests, long openDisputes,
                          double kgDiverted, int pickups, int collections, Double keptFromDumpPercent,
                          LocalDateTime lastActivityAt) {
    }

    public record CitySummary(int wards, int wardsWithOfficer, long registeredHouseholds, long officialHouseholds,
                              long population, long dealers, long openRequests, long openDisputes, ImpactView impact) {
    }

    public record CityView(CitySummary summary, List<WardRow> wards) {
    }

    /** An officer with what they have done, for the commissioner's officer list. */
    public record OfficerRow(Long id, String name, String phone, Long wardId, String wardLabel, boolean active,
                             LocalDateTime lastActionAt, long actions) {
    }

    public record WardDetail(WardRow row, List<OfficerRow> officers, List<StaffView> staff, List<CollectorRow> dealers,
                             List<ActivityLog.Entry> activity) {
    }

    private final WardDirectory wards;
    private final UserDirectory users;
    private final OfficerDirectory officers;
    private final ImpactReader impact;
    private final MunicipalRequestRepository requests;
    private final MunicipalStaffRepository staff;
    private final MunicipalDisputeService disputes;
    private final MunicipalOverviewService overview;
    private final ActivityLog activity;
    private final MunicipalScope scope;

    public MunicipalCityService(WardDirectory wards, UserDirectory users, OfficerDirectory officers, ImpactReader impact,
                                MunicipalRequestRepository requests, MunicipalStaffRepository staff,
                                MunicipalDisputeService disputes, MunicipalOverviewService overview,
                                ActivityLog activity, MunicipalScope scope) {
        this.wards = wards;
        this.users = users;
        this.officers = officers;
        this.impact = impact;
        this.requests = requests;
        this.staff = staff;
        this.disputes = disputes;
        this.overview = overview;
        this.activity = activity;
        this.scope = scope;
    }

    @Transactional(readOnly = true)
    public CityView city(long commissionerId) {
        scope.requireCommissioner(commissionerId);
        Map<Long, Map<Role, Long>> people = users.countByRoleInEachWard();
        Map<Long, List<CollectorProfile>> dealersByWard = users.allCollectors(null).stream()
                .filter(c -> c.user().wardId() != null).collect(Collectors.groupingBy(c -> c.user().wardId()));
        Map<Long, Long> openRequests = new HashMap<>();
        requests.openByWard().forEach(r -> openRequests.put((Long) r[0], (Long) r[1]));
        Map<Long, Long> openDisputes = disputes.openByWard();
        Map<Long, ImpactView> impacts = impact.summariesByWard();
        Map<Long, List<Officer>> officersByWard = officers.all().stream().collect(Collectors.groupingBy(Officer::wardId));
        Map<Long, LocalDateTime> lastAction = activity.lastActionByWard();

        List<WardRow> rows = wards.all().stream().map(w -> row(w, people.getOrDefault(w.id(), Map.of()),
                dealersByWard.getOrDefault(w.id(), List.of()), openRequests.getOrDefault(w.id(), 0L),
                openDisputes.getOrDefault(w.id(), 0L), impacts.get(w.id()),
                officersByWard.getOrDefault(w.id(), List.of()), lastAction.get(w.id()))).toList();

        CitySummary summary = new CitySummary(rows.size(), (int) rows.stream().filter(r -> r.officers().stream().anyMatch(OfficerBrief::active)).count(),
                rows.stream().mapToLong(WardRow::registeredHouseholds).sum(),
                wards.all().stream().mapToLong(w -> w.households() == null ? 0 : w.households()).sum(),
                wards.all().stream().mapToLong(w -> w.population() == null ? 0 : w.population()).sum(),
                rows.stream().mapToLong(WardRow::dealers).sum(), rows.stream().mapToLong(WardRow::openRequests).sum(),
                rows.stream().mapToLong(WardRow::openDisputes).sum(), impact.summary(null));
        return new CityView(summary, rows);
    }

    @Transactional(readOnly = true)
    public WardDetail ward(long commissionerId, long wardId) {
        scope.requireCommissioner(commissionerId);
        WardInfo w = wards.find(wardId).orElseThrow(() -> ApiException.notFound("WARD_UNKNOWN", "That ward does not exist"));
        WardRow row = city(commissionerId).wards().stream().filter(r -> r.ward().id() == wardId).findFirst().orElseThrow();
        return new WardDetail(row, officerRows().stream().filter(o -> o.wardId() == wardId).toList(),
                staff.findByWardIdOrderByIdDesc(wardId).stream().map(MunicipalStaffService::view).toList(),
                overview.collectorsOf(wardId), activity.recent(wardId));
    }

    /** Every ward officer with their ward, when they last did something and how much they did. */
    @Transactional(readOnly = true)
    public List<OfficerRow> officerRows() {
        Map<Long, Object[]> summary = activity.summaryByOfficer();
        return officers.all().stream().map(o -> {
            Object[] s = summary.get(o.id());
            return new OfficerRow(o.id(), o.name(), o.phone(), o.wardId(), wards.find(o.wardId()).map(WardInfo::label).orElse("?"),
                    o.active(), s == null ? null : (LocalDateTime) s[1], s == null ? 0 : (Long) s[2]);
        }).toList();
    }

    private static WardRow row(WardInfo w, Map<Role, Long> people, List<CollectorProfile> dealers, long openRequests,
                               long openDisputes, ImpactView impact, List<Officer> officers, LocalDateTime lastAction) {
        return new WardRow(w, officers.stream().map(o -> new OfficerBrief(o.id(), o.name(), o.phone(), o.active())).toList(),
                people.getOrDefault(Role.HOUSEHOLD, 0L), dealers.size(),
                dealers.stream().filter(c -> c.verification() == VerificationStatus.VERIFIED).count(),
                dealers.stream().filter(c -> c.verification() == VerificationStatus.PENDING).count(),
                openRequests, openDisputes, impact == null ? 0 : impact.kgDiverted(), impact == null ? 0 : impact.pickups(),
                impact == null ? 0 : impact.collections(),
                impact == null ? null : impact.keptFromDumpPercent(), lastAction);
    }
}
