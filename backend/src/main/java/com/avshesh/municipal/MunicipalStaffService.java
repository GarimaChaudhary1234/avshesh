package com.avshesh.municipal;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.user.StaffAccounts;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Service
public class MunicipalStaffService {

    public record StaffInput(@NotBlank @Size(max = 100) String name,
                             @NotBlank @Pattern(regexp = "\\d{10}", message = "must be a 10 digit number") String phone,
                             @NotBlank @Size(min = 6, max = 72) String password) {
    }

    /** {@code hasLogin}: the worker can log in with their phone number and see their assigned pickups. */
    public record StaffView(Long id, Long wardId, String name, String phone, boolean active, boolean hasLogin) {
    }

    private final MunicipalStaffRepository staff;
    private final MunicipalScope scope;
    private final StaffAccounts accounts;

    public MunicipalStaffService(MunicipalStaffRepository staff, MunicipalScope scope, StaffAccounts accounts) {
        this.staff = staff;
        this.scope = scope;
        this.accounts = accounts;
    }

    @Transactional(readOnly = true)
    public List<StaffView> list(long officerId) {
        Long ward = scope.wardOf(officerId);
        List<MunicipalStaff> rows = ward == null ? staff.findAllByOrderByIdDesc() : staff.findByWardIdOrderByIdDesc(ward);
        return rows.stream().map(MunicipalStaffService::view).toList();
    }

    @Transactional
    public StaffView create(long officerId, StaffInput in) {
        Long ward = scope.wardOf(officerId);
        if (ward == null) {
            throw ApiException.badRequest("STAFF_WARD_ONLY", "Staff are managed by the officer of each ward");
        }
        MunicipalStaff s = new MunicipalStaff();
        s.setWardId(ward);
        s.setName(in.name().strip());
        s.setPhone(in.phone());
        // The phone number is the login: a number that already has an account is refused here (409).
        s.setUserId(accounts.create(in.name(), in.phone(), in.password(), ward));
        return view(staff.save(s));
    }

    @Transactional
    public StaffView setActive(long officerId, long staffId, boolean active) {
        MunicipalStaff s = staff.findById(staffId).orElseThrow(() -> ApiException.notFound("Staff member not found"));
        scope.requireAccess(scope.wardOf(officerId), s.getWardId());
        s.setActive(active);
        if (s.getUserId() != null) {
            accounts.setActive(s.getUserId(), active);
        }
        return view(staff.save(s));
    }

    /** For request assignment: the staff member must exist, be active and belong to the request's ward. */
    MunicipalStaff requireAssignable(long staffId, Long wardId) {
        MunicipalStaff s = staff.findById(staffId).orElseThrow(() -> ApiException.badRequest("Staff member not found"));
        if (!s.isActive() || !s.getWardId().equals(wardId)) {
            throw ApiException.badRequest("STAFF_INVALID", "Choose an active staff member of this ward");
        }
        return s;
    }

    /** The worker record of a logged-in collection worker. */
    MunicipalStaff ofUser(long userId) {
        return staff.findByUserId(userId).orElseThrow(() ->
                ApiException.forbidden("STAFF_NOT_LINKED", "This account is not linked to a collection worker"));
    }

    MunicipalStaff find(Long staffId) {
        return staffId == null ? null : staff.findById(staffId).orElse(null);
    }

    static StaffView view(MunicipalStaff s) {
        return new StaffView(s.getId(), s.getWardId(), s.getName(), s.getPhone(), s.isActive(), s.getUserId() != null);
    }
}
