package com.avshesh.pool;

import org.springframework.stereotype.Component;

import com.avshesh.user.CollectorProfile;

/** A pool must fit in one trip of the vehicle. A bigger pool is left for a collector with a bigger vehicle. */
@Component
public class VehicleCapacityPolicy implements CapacityPolicy {

    @Override
    public boolean fits(CollectorProfile collector, double totalKg) {
        return totalKg <= collector.vehicleCapacityKg();
    }
}
