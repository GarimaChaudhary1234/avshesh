package com.avshesh.rating;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.listing.ListingLookup;
import com.avshesh.listing.ListingStatus;
import com.avshesh.listing.ListingSummary;
import com.avshesh.listing.PickupInfo;
import com.avshesh.listing.PickupInfoProvider;
import com.avshesh.user.AccountSignals;
import com.avshesh.user.Role;
import com.avshesh.user.UserDirectory;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

@Service
public class RatingService implements RatingLookup {

    public record NewRating(long listingId, @Min(1) @Max(5) int stars, @Size(max = 255) String comment) {
    }

    public record MyRating(Long listingId, int stars, String comment) {
    }

    public record Review(int stars, String comment, LocalDateTime createdAt) {
    }

    /** What a collector sees about themselves. */
    public record CollectorRating(RatingSummary summary, List<Review> recent) {
    }

    /** A rating from the same network as the dealer counts a quarter: it may be the dealer rating themselves. */
    private static final double SAME_NETWORK_WEIGHT = 0.25;
    /** After this many ratings in 30 days from one network, further ones count half. */
    private static final int MANY_FROM_ONE_NETWORK = 3;
    private static final double CROWDED_NETWORK_WEIGHT = 0.5;

    private final RatingRepository ratings;
    private final AccountSignals signals;
    private final ListingLookup listings;
    private final PickupInfoProvider pickupInfo;
    private final UserDirectory users;

    public RatingService(RatingRepository ratings, ListingLookup listings, PickupInfoProvider pickupInfo,
                         UserDirectory users, AccountSignals signals) {
        this.ratings = ratings;
        this.listings = listings;
        this.pickupInfo = pickupInfo;
        this.users = users;
        this.signals = signals;
    }

    @Transactional
    public MyRating create(long householdId, NewRating in) {
        users.requireVerifiedRole(householdId, Role.HOUSEHOLD);
        ListingSummary listing = listings.get(in.listingId());
        if (!listing.ownerId().equals(householdId)) {
            throw ApiException.forbidden("RATING_NOT_OWN", "You can only rate your own pickups");
        }
        if (listing.status() != ListingStatus.DONE) {
            throw ApiException.badRequest("RATING_NOT_DONE", "You can rate a collector after the pickup is completed");
        }
        if (ratings.existsByListingId(in.listingId())) {
            throw ApiException.conflict("RATING_DUPLICATE", "You have already rated this pickup");
        }
        PickupInfo info = pickupInfo.forListings(List.of(in.listingId())).get(in.listingId());
        if (info == null) {
            throw ApiException.badRequest("RATING_NO_COLLECTOR", "This listing was not collected by a scrap dealer or compost center");
        }

        String householdHash = signals.registeredIpHash(householdId).orElse(null);
        String dealerHash = signals.registeredIpHash(info.collectorId()).orElse(null);
        double weight = 1.0;
        if (householdHash != null && householdHash.equals(dealerHash)) {
            weight = SAME_NETWORK_WEIGHT;
        } else if (householdHash != null && ratings.countByCollectorIdAndHouseholdIpHashAndCreatedAtAfter(
                info.collectorId(), householdHash, LocalDateTime.now().minusDays(30)) >= MANY_FROM_ONE_NETWORK) {
            weight = CROWDED_NETWORK_WEIGHT;
        }

        Rating r = new Rating();
        r.setWeight(weight);
        r.setHouseholdIpHash(householdHash);
        r.setListingId(in.listingId());
        r.setHouseholdId(householdId);
        r.setCollectorId(info.collectorId());
        r.setStars(in.stars());
        r.setComment(in.comment() == null || in.comment().isBlank() ? null : in.comment().strip());
        ratings.save(r);
        return new MyRating(r.getListingId(), r.getStars(), r.getComment());
    }

    @Transactional(readOnly = true)
    public List<MyRating> mine(long householdId) {
        users.requireRole(householdId, Role.HOUSEHOLD);
        return ratings.findByHouseholdIdOrderByIdDesc(householdId).stream()
                .map(r -> new MyRating(r.getListingId(), r.getStars(), r.getComment())).toList();
    }

    @Transactional(readOnly = true)
    public CollectorRating ofCollector(long collectorId) {
        users.requireCollector(collectorId);
        RatingSummary summary = forCollectors(List.of(collectorId)).getOrDefault(collectorId, RatingSummary.NONE);
        List<Review> recent = ratings.findTop5ByCollectorIdAndCommentIsNotNullOrderByIdDesc(collectorId).stream()
                .map(r -> new Review(r.getStars(), r.getComment(), r.getCreatedAt())).toList();
        return new CollectorRating(summary, recent);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, RatingSummary> forCollectors(Collection<Long> collectorIds) {
        Map<Long, RatingSummary> result = new HashMap<>();
        if (collectorIds.isEmpty()) {
            return result;
        }
        for (Object[] row : ratings.summaries(collectorIds)) {
            double weightedStars = ((Number) row[1]).doubleValue();
            double totalWeight = ((Number) row[2]).doubleValue();
            double average = totalWeight == 0 ? 0 : weightedStars / totalWeight;
            result.put((Long) row[0], new RatingSummary(Math.round(average * 10) / 10.0, ((Number) row[3]).intValue()));
        }
        return result;
    }
}
