package com.avshesh.pool;

import java.util.EnumSet;
import java.util.Set;

public enum PoolStatus {
    FILLING,
    READY,
    ACCEPTED,
    DONE;

    /** Pools that can still take new listings. */
    public static final Set<PoolStatus> OPEN = EnumSet.of(FILLING, READY);
}
