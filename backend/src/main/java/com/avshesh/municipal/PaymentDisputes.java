package com.avshesh.municipal;

import java.time.LocalDateTime;
import java.util.List;

/** Port owned by the municipal module and implemented by the pickup module, which holds the payments. */
public interface PaymentDisputes {

    /** @param status DISPUTED (open) or RESOLVED */
    record Dispute(Long stopId, Long wardId, String householdName, String householdPhone, String dealerName,
                   String dealerPhone, String itemCode, double actualKg, double amountPaid, String paymentMode,
                   String note, String status, String resolutionNote, LocalDateTime raisedAt) {
    }

    /** The newest disputes of every ward, open ones first. */
    List<Dispute> recent();

    Dispute get(long stopId);

    Dispute resolve(long stopId, String resolutionNote);
}
