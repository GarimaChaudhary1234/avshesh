package com.avshesh.user;

/** Write side for collector settings, kept apart from {@link UserDirectory} so readers cannot change data. */
public interface CollectorSettingsUpdater {

    void update(long collectorId, double serviceRadiusKm, double minTripProfit, double minLoadKg,
                Double dailyCapacityKg);
}
