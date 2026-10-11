package com.avshesh.pool;

import com.avshesh.user.CollectorProfile;

/** Decides whether a pool is small enough for one trip of a collector's vehicle. */
public interface CapacityPolicy {

    boolean fits(CollectorProfile collector, double totalKg);
}
