package com.avshesh.pickup;

import java.util.List;
import java.util.Map;

import com.avshesh.pool.PoolItem;
import com.avshesh.user.UserAccount;

/** Decides the order in which a collector visits homes. */
public interface RouteOrderer {

    List<PoolItem> order(UserAccount start, List<PoolItem> items, Map<Long, UserAccount> owners);
}
