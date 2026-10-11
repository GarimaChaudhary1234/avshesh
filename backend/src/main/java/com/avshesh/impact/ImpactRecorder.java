package com.avshesh.impact;

import com.avshesh.scan.Category;

/** Write side of impact tracking, called when a stop is completed. */
public interface ImpactRecorder {

    void record(String areaGeohash, Long wardId, Category category, double kgDiverted, double paidToHousehold,
                Long stopId, Long pickupId);
}
