package com.avshesh.user;

import java.util.List;

/**
 * Ward officers, for the commissioner who creates and moves them. A ward officer is a municipal account tied to
 * one ward. (A commissioner is a municipal account with no ward and is not managed here.)
 */
public interface OfficerDirectory {

    record Officer(Long id, String name, String phone, Long wardId, boolean active) {
    }

    /** Every ward officer, including switched-off ones. */
    List<Officer> all();

    Officer create(String name, String phone, String password, long wardId);

    /** Moves the officer to another ward. The officer's permissions follow at once: they are read from the account. */
    Officer moveTo(long officerId, long wardId);

    Officer setActive(long officerId, boolean active);
}
