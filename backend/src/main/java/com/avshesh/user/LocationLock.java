package com.avshesh.user;

/**
 * A module that has work tied to where a user lives says so here, and the user cannot move until it is finished.
 * Moving a household in the middle of a pool, or a dealer in the middle of a route, would break that work.
 */
public interface LocationLock {

    /** True while this user has work that depends on their current location. */
    boolean holdsLocation(long userId);
}
