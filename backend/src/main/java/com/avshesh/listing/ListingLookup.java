package com.avshesh.listing;

import java.util.Collection;
import java.util.Map;

public interface ListingLookup {

    ListingSummary get(long listingId);

    Map<Long, ListingSummary> getAll(Collection<Long> listingIds);
}
