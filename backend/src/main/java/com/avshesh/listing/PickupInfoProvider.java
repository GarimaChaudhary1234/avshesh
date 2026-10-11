package com.avshesh.listing;

import java.util.Collection;
import java.util.Map;

/** Port owned by the listing module and implemented by the pickup module, so listing never imports pickup. */
public interface PickupInfoProvider {

    Map<Long, PickupInfo> forListings(Collection<Long> listingIds);
}
