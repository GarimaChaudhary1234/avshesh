package com.avshesh.municipal;

import java.util.List;

import org.springframework.stereotype.Component;

import com.avshesh.user.LocationLock;

/** A household whose municipal pickup request is still open or scheduled is tied to its ward until it is done. */
@Component
class MunicipalRequestLocationLock implements LocationLock {

    private final MunicipalRequestRepository requests;

    MunicipalRequestLocationLock(MunicipalRequestRepository requests) {
        this.requests = requests;
    }

    @Override
    public boolean holdsLocation(long userId) {
        return requests.existsByHouseholdIdAndStatusIn(userId, List.of(RequestStatus.OPEN, RequestStatus.SCHEDULED));
    }
}
