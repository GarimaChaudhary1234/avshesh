package com.avshesh.pool;

import java.util.List;
import java.util.Map;

import com.avshesh.ratecard.Rate;

/** Decides what a pool is worth to a collector. Replace the implementation to change the business rule. */
public interface ProfitPolicy {

    /** @param costPerKm what one km of travel costs this collector (depends on their vehicle) */
    double profit(List<PoolItem> items, Map<String, Rate> rates, double distanceKm, double costPerKm);
}
