package com.avshesh.pool;

import java.util.List;
import java.util.Set;

/**
 * Port owned by the pool module and implemented by whoever stores listings. Keeps pool logic free of
 * any dependency on the listing module.
 */
public interface PoolMembership {

    List<PoolItem> itemsInPool(Long poolId);

    Set<Long> poolIdsOfOwner(long ownerId);
}
