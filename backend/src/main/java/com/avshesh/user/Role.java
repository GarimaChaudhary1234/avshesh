package com.avshesh.user;

public enum Role {
    HOUSEHOLD,
    KABADIWALA,
    COMPOST,
    /** City officer. Cannot self-register: accounts are created by the platform operator. */
    MUNICIPAL,
    /** A municipal collection worker: sees the pickups assigned to them. Accounts are created by a ward officer. */
    FIELD_STAFF
}
