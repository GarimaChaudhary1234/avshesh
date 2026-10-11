package com.avshesh.listing;

import java.time.LocalDateTime;

/** Pickup details of one listing: when, and the outcome once done. */
public record PickupInfo(Long collectorId, LocalDateTime start, LocalDateTime end, Double actualKg, Double amountPaid,
                         LocalDateTime doneAt, String paymentStatus) {

    public boolean isDone() {
        return doneAt != null;
    }
}
