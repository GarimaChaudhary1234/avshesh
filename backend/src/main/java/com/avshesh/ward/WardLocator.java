package com.avshesh.ward;

import java.util.Optional;

/** Finds which ward a coordinate falls in. */
public interface WardLocator {

    /** Empty when the point is outside every known ward. */
    Optional<Long> wardIdAt(double lat, double lng);
}
