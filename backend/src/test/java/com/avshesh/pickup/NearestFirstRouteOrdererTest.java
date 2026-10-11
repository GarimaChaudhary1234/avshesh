package com.avshesh.pickup;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.avshesh.pool.PoolItem;
import com.avshesh.user.Role;
import com.avshesh.user.UserAccount;

class NearestFirstRouteOrdererTest {

    private final NearestFirstRouteOrderer orderer = new NearestFirstRouteOrderer();

    private static UserAccount at(long id, double lat, double lng) {
        return new UserAccount(id, Role.HOUSEHOLD, "H" + id, "9" + id, lat, lng, "tgt582", 15L, true, "en");
    }

    private static PoolItem item(long listingId, long owner) {
        return new PoolItem(listingId, owner, "PET_BOTTLE", 1, LocalDate.now());
    }

    @Test
    void visitsTheClosestHomeFirstAndThenChainsOutwards() {
        UserAccount dealer = at(100, 20.300, 85.800);
        Map<Long, UserAccount> owners = Map.of(
                1L, at(1, 20.320, 85.800),   // far north
                2L, at(2, 20.301, 85.800),   // closest to the dealer
                3L, at(3, 20.310, 85.800));  // middle
        List<PoolItem> ordered = orderer.order(dealer, List.of(item(10, 1), item(20, 2), item(30, 3)), owners);
        assertEquals(List.of(20L, 30L, 10L), ordered.stream().map(PoolItem::listingId).toList());
    }

    @Test
    void keepsEveryItemExactlyOnce() {
        UserAccount dealer = at(100, 20.3, 85.8);
        Map<Long, UserAccount> owners = Map.of(1L, at(1, 20.31, 85.8), 2L, at(2, 20.32, 85.8));
        List<PoolItem> in = List.of(item(10, 1), item(11, 1), item(20, 2));
        List<PoolItem> out = orderer.order(dealer, in, owners);
        assertEquals(3, out.size());
        assertTrue(out.containsAll(in));
    }

    @Test
    void anEmptyPoolGivesAnEmptyRoute() {
        assertTrue(orderer.order(at(100, 20.3, 85.8), List.of(), Map.of()).isEmpty());
    }

    @Test
    void doesNotChangeTheInputList() {
        UserAccount dealer = at(100, 20.3, 85.8);
        Map<Long, UserAccount> owners = Map.of(1L, at(1, 20.4, 85.8), 2L, at(2, 20.31, 85.8));
        List<PoolItem> in = List.of(item(10, 1), item(20, 2));
        orderer.order(dealer, in, owners);
        assertEquals(10L, in.get(0).listingId());
    }
}
