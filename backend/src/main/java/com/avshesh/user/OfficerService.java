package com.avshesh.user;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.ward.WardDirectory;

@Service
public class OfficerService implements OfficerDirectory {

    private final UserRepository users;
    private final AccountService accounts;
    private final WardDirectory wards;

    public OfficerService(UserRepository users, AccountService accounts, WardDirectory wards) {
        this.users = users;
        this.accounts = accounts;
        this.wards = wards;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Officer> all() {
        return users.findByRoleAndWardIdIsNotNullOrderByIdDesc(Role.MUNICIPAL).stream().map(OfficerService::view).toList();
    }

    @Override
    @Transactional
    public Officer create(String name, String phone, String password, long wardId) {
        requireWard(wardId);
        UserAccount created = accounts.registerOfficer(phone, name.strip(), password, wardId);
        return view(users.findById(created.id()).orElseThrow());
    }

    @Override
    @Transactional
    public Officer moveTo(long officerId, long wardId) {
        requireWard(wardId);
        User u = officer(officerId);
        u.setWardId(wardId);
        return view(users.save(u));
    }

    @Override
    @Transactional
    public Officer setActive(long officerId, boolean active) {
        User u = officer(officerId);
        u.setActive(active);
        return view(users.save(u));
    }

    private User officer(long id) {
        User u = users.findById(id).orElseThrow(() -> ApiException.notFound("OFFICER_NOT_FOUND", "Officer not found"));
        // Only ward officers are managed here: a commissioner (no ward) or a citizen is not an officer.
        if (u.getRole() != Role.MUNICIPAL || u.getWardId() == null) {
            throw ApiException.notFound("OFFICER_NOT_FOUND", "Officer not found");
        }
        return u;
    }

    private void requireWard(long wardId) {
        if (wards.find(wardId).isEmpty()) {
            throw ApiException.badRequest("WARD_UNKNOWN", "That ward does not exist");
        }
    }

    private static Officer view(User u) {
        return new Officer(u.getId(), u.getName(), u.getPhone(), u.getWardId(), u.isActive());
    }
}
