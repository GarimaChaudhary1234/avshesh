package com.avshesh.user;

/** Write side for the business profile a collector edits about themselves. */
public interface CollectorProfileUpdater {

    void update(long collectorId, CollectorBusinessProfile profile);
}
