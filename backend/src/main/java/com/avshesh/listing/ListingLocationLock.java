package com.avshesh.listing;

import org.springframework.stereotype.Component;

import com.avshesh.user.LocationLock;

/** A household with an open or scheduled listing is part of a pool and cannot move. */
@Component
class ListingLocationLock implements LocationLock {

    private final ListingRepository listings;

    ListingLocationLock(ListingRepository listings) {
        this.listings = listings;
    }

    @Override
    public boolean holdsLocation(long userId) {
        return listings.existsByOwnerIdAndStatusNot(userId, ListingStatus.DONE);
    }
}
