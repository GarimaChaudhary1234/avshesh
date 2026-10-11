package com.avshesh.listing;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.pool.PoolItem;
import com.avshesh.pool.PoolMembership;

/** The listing module's face to the rest of the app: lookups, status changes and pool membership. */
@Service
public class ListingRegistry implements ListingLookup, ListingLifecycle, PoolMembership {

    private final ListingRepository listings;

    public ListingRegistry(ListingRepository listings) {
        this.listings = listings;
    }

    @Override
    @Transactional(readOnly = true)
    public ListingSummary get(long listingId) {
        return listings.findById(listingId).map(ListingSummary::from)
                .orElseThrow(() -> ApiException.notFound("Listing not found"));
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, ListingSummary> getAll(Collection<Long> listingIds) {
        return listings.findAllById(listingIds).stream().map(ListingSummary::from)
                .collect(Collectors.toMap(ListingSummary::id, Function.identity()));
    }

    @Override
    @Transactional
    public void markScheduled(Collection<Long> listingIds) {
        listings.findAllById(listingIds).forEach(l -> l.setStatus(ListingStatus.SCHEDULED));
    }

    @Override
    @Transactional
    public void markDone(long listingId) {
        listings.findById(listingId).ifPresent(l -> l.setStatus(ListingStatus.DONE));
    }

    @Override
    @Transactional(readOnly = true)
    public List<PoolItem> itemsInPool(Long poolId) {
        return listings.findByPoolId(poolId).stream()
                .map(l -> new PoolItem(l.getId(), l.getOwnerId(), l.getItemCode(), l.getEstKg(), l.getReadyFrom()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Set<Long> poolIdsOfOwner(long ownerId) {
        return listings.findByOwnerIdOrderByIdDesc(ownerId).stream()
                .map(Listing::getPoolId).filter(Objects::nonNull).collect(Collectors.toSet());
    }
}
