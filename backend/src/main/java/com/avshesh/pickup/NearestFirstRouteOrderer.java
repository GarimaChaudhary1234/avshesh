package com.avshesh.pickup;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.avshesh.common.GeoUtil;
import com.avshesh.pool.PoolItem;
import com.avshesh.user.UserAccount;

/** Greedy nearest-neighbour: from where you stand, always go to the closest remaining home. */
@Component
public class NearestFirstRouteOrderer implements RouteOrderer {

    @Override
    public List<PoolItem> order(UserAccount start, List<PoolItem> items, Map<Long, UserAccount> owners) {
        List<PoolItem> remaining = new ArrayList<>(items);
        List<PoolItem> ordered = new ArrayList<>(items.size());
        UserAccount here = start;
        while (!remaining.isEmpty()) {
            UserAccount from = here;
            PoolItem next = remaining.stream()
                    .min(Comparator.comparingDouble(i -> distance(from, owners.get(i.ownerId()))))
                    .orElseThrow();
            remaining.remove(next);
            ordered.add(next);
            here = owners.get(next.ownerId());
        }
        return ordered;
    }

    private static double distance(UserAccount a, UserAccount b) {
        return GeoUtil.distanceKm(a.lat(), a.lng(), b.lat(), b.lng());
    }
}
