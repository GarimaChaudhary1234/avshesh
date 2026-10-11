package com.avshesh.user;

/**
 * Logins for the municipal collection workers. The worker's record (name, ward, assignments) lives in the municipal
 * module; this only creates and switches the account they log in with.
 */
public interface StaffAccounts {

    /** Creates the login (the phone number is the user name) and returns the new user id. */
    long create(String name, String phone, String password, long wardId);

    /** Switches the login off or on together with the worker's record. */
    void setActive(long userId, boolean active);
}
