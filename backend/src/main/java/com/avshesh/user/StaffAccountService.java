package com.avshesh.user;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;

@Service
public class StaffAccountService implements StaffAccounts {

    private final AccountService accounts;
    private final UserRepository users;

    public StaffAccountService(AccountService accounts, UserRepository users) {
        this.accounts = accounts;
        this.users = users;
    }

    @Override
    @Transactional
    public long create(String name, String phone, String password, long wardId) {
        return accounts.registerStaff(phone, name.strip(), password, wardId).id();
    }

    @Override
    @Transactional
    public void setActive(long userId, boolean active) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound("User not found"));
        if (u.getRole() != Role.FIELD_STAFF) {
            throw ApiException.forbidden("ROLE_FORBIDDEN", "This action is not available for your role");
        }
        u.setActive(active);
        users.save(u);
    }
}
