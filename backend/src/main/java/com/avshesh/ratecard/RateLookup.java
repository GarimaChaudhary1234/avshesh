package com.avshesh.ratecard;

import java.util.Map;
import java.util.Optional;

import com.avshesh.user.UserAccount;

/** Read-only rate queries used by scan, pool and pickup. */
public interface RateLookup {

    /** All rates of one collector, keyed by item code. */
    Map<String, Rate> ratesOf(long collectorId);

    /** Highest buy rate among collectors whose service area covers the household. */
    Optional<LocalRate> bestLocalRate(UserAccount household, String itemCode);
}
