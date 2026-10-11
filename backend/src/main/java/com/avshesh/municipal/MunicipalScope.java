package com.avshesh.municipal;

import org.springframework.stereotype.Component;

import com.avshesh.common.ApiException;
import com.avshesh.user.Role;
import com.avshesh.user.UserDirectory;

/**
 * Which part of the city a municipal officer may see and change. A ward officer is limited to their
 * ward; a city-wide commissioner (no ward) sees everything.
 */
@Component
public class MunicipalScope {

    private final UserDirectory users;

    public MunicipalScope(UserDirectory users) {
        this.users = users;
    }

    /** The officer's ward, or null for a commissioner who sees every ward. */
    public Long wardOf(long officerId) {
        return users.requireRole(officerId, Role.MUNICIPAL).wardId();
    }

    /** The ward of a ward officer; fails with 403 for the commissioner, who manages officers and does not handle requests. */
    public Long requireWardOfficer(long officerId) {
        Long ward = wardOf(officerId);
        if (ward == null) {
            throw ApiException.forbidden("WARD_OFFICER_ONLY", "Only the officer of the ward can do this");
        }
        return ward;
    }

    /** Fails with 403 unless this is the city commissioner (a municipal account with no ward). */
    public void requireCommissioner(long officerId) {
        if (wardOf(officerId) != null) {
            throw ApiException.forbidden("COMMISSIONER_ONLY", "Only the city commissioner can do this");
        }
    }

    /** Fails with 403 if the officer is limited to a ward and the thing belongs to another one. */
    public void requireAccess(Long officerWard, Long ownerWard) {
        if (officerWard != null && !officerWard.equals(ownerWard)) {
            throw ApiException.forbidden("WARD_FORBIDDEN", "This belongs to another ward");
        }
    }
}
