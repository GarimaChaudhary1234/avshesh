package com.avshesh.pool;

import java.time.LocalDate;
import java.util.List;

/** One household's listing as the pool sees it. */
public record PoolItem(Long listingId, Long ownerId, String itemCode, double estKg, LocalDate readyFrom) {

    public static double totalKg(List<PoolItem> items) {
        return items.stream().mapToDouble(PoolItem::estKg).sum();
    }

    public static int households(List<PoolItem> items) {
        return (int) items.stream().map(PoolItem::ownerId).distinct().count();
    }
}
