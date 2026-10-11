package com.avshesh.pickup;

import org.springframework.stereotype.Component;

import com.avshesh.user.LocationLock;

/** A dealer with a scheduled pickup has a planned route and cannot move. */
@Component
class PickupLocationLock implements LocationLock {

    private final PickupRepository pickups;

    PickupLocationLock(PickupRepository pickups) {
        this.pickups = pickups;
    }

    @Override
    public boolean holdsLocation(long userId) {
        return pickups.existsByCollectorIdAndStatus(userId, PickupStatus.SCHEDULED);
    }
}
