package com.avshesh.pool;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.avshesh.ratecard.Rate;

/** Resale margin of the items in the pool, minus the round-trip cost of driving there. */
@Component
public class MarginMinusTravelPolicy implements ProfitPolicy {

    @Override
    public double profit(List<PoolItem> items, Map<String, Rate> rates, double distanceKm, double costPerKm) {
        double margin = 0;
        for (PoolItem item : items) {
            Rate rate = rates.get(item.itemCode());
            if (rate != null) {
                margin += item.estKg() * rate.margin();
            }
        }
        return margin - distanceKm * 2 * costPerKm;
    }
}
