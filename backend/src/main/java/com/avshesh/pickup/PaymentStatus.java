package com.avshesh.pickup;

/** What the household says about the money for one collected stop. */
public enum PaymentStatus {
    /** Collected, the household has not answered yet. */
    PENDING,
    CONFIRMED,
    /** The household says it did not receive the money. Goes to the municipal officer. */
    DISPUTED,
    /** The municipal officer looked into the dispute and closed it. */
    RESOLVED
}
