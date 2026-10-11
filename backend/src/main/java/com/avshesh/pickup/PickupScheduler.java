package com.avshesh.pickup;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.listing.ListingLifecycle;
import com.avshesh.notification.Notifier;
import com.avshesh.pickup.PickupQueryService.PickupView;
import com.avshesh.pool.PoolItem;
import com.avshesh.pool.PoolService;
import com.avshesh.pool.PoolService.ReservedPool;
import com.avshesh.user.CollectorProfile;
import com.avshesh.user.UserAccount;
import com.avshesh.user.UserDirectory;

/** A collector accepts a READY pool: books the slot, fixes the visiting order, tells every home. */
@Service
public class PickupScheduler {

    private final PoolService pools;
    private final UserDirectory users;
    private final ListingLifecycle listings;
    private final PickupRepository pickups;
    private final PickupStopRepository stops;
    private final PickupQueryService queries;
    private final RouteOrderer routeOrderer;
    private final Notifier notifier;

    public PickupScheduler(PoolService pools, UserDirectory users, ListingLifecycle listings,
                           PickupRepository pickups, PickupStopRepository stops, PickupQueryService queries,
                           RouteOrderer routeOrderer, Notifier notifier) {
        this.pools = pools;
        this.users = users;
        this.listings = listings;
        this.pickups = pickups;
        this.stops = stops;
        this.queries = queries;
        this.routeOrderer = routeOrderer;
        this.notifier = notifier;
    }

    @Transactional
    public PickupView accept(long collectorId, long poolId, LocalDateTime start, LocalDateTime end) {
        CollectorProfile collector = users.requireCollector(collectorId);
        if (!collector.user().phoneVerified()) {
            throw ApiException.forbidden("PHONE_NOT_VERIFIED", "Please verify your phone number first");
        }
        if (start == null || end == null || !end.isAfter(start) || start.isBefore(LocalDateTime.now())) {
            throw ApiException.badRequest("PICKUP_TIME_INVALID", "Pickup start and end must be valid, and start must be in the future");
        }
        ReservedPool reserved = pools.reserve(collectorId, poolId);
        // If this fails the transaction rolls back and the pool is released again.
        LocalDate latestReady = reserved.items().stream().map(PoolItem::readyFrom).max(LocalDate::compareTo)
                .orElse(LocalDate.now());
        double poolKg = PoolItem.totalKg(reserved.items());
        if (collector.dailyCapacityKg() != null) {
            double planned = queries.plannedKgOn(collectorId, start.toLocalDate());
            if (planned + poolKg > collector.dailyCapacityKg()) {
                throw ApiException.conflict("CAPACITY_DAILY",
                        "That day you already have {0} kg planned, and your daily limit is {1} kg. Choose another day.",
                        Math.round(planned), Math.round(collector.dailyCapacityKg()));
            }
        }
        if (start.toLocalDate().isBefore(latestReady)) {
            throw ApiException.badRequest("PICKUP_BEFORE_READY",
                    "Some households are only ready from {0}. Choose a pickup on or after that date.", latestReady.toString());
        }

        Pickup pickup = new Pickup();
        pickup.setPoolId(poolId);
        pickup.setCollectorId(collectorId);
        pickup.setScheduledStart(start);
        pickup.setScheduledEnd(end);
        pickup = pickups.save(pickup);

        Map<Long, UserAccount> owners = users.getAll(
                reserved.items().stream().map(PoolItem::ownerId).distinct().toList());
        List<PoolItem> ordered = routeOrderer.order(collector.user(), reserved.items(), owners);

        int seq = 1;
        for (PoolItem item : ordered) {
            PickupStop stop = new PickupStop();
            stop.setPickupId(pickup.getId());
            stop.setListingId(item.listingId());
            stop.setSeq(seq++);
            stops.save(stop);
            notifier.notify(item.ownerId(), "pickup.confirmed", start.toLocalDate().toString(),
                    start.toLocalTime() + "-" + end.toLocalTime(), collector.displayName());
        }
        listings.markScheduled(ordered.stream().map(PoolItem::listingId).toList());
        return queries.view(pickup);
    }
}
