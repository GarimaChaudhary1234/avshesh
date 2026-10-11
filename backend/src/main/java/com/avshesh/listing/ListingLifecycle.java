package com.avshesh.listing;

import java.util.Collection;

/** Status changes that the pickup flow is allowed to make on listings. */
public interface ListingLifecycle {

    void markScheduled(Collection<Long> listingIds);

    void markDone(long listingId);
}
