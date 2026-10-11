package com.avshesh.listing;

import com.avshesh.scan.Category;

/** What other modules may know about a listing. The Listing entity stays inside this module. */
public record ListingSummary(Long id, Long ownerId, String itemCode, Category category, double estKg,
                             ListingStatus status) {

    static ListingSummary from(Listing l) {
        return new ListingSummary(l.getId(), l.getOwnerId(), l.getItemCode(), l.getCategory(), l.getEstKg(),
                l.getStatus());
    }
}
