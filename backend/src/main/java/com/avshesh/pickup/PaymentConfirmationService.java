package com.avshesh.pickup;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.listing.ListingLookup;
import com.avshesh.listing.ListingSummary;
import com.avshesh.notification.Notifier;
import com.avshesh.user.Role;
import com.avshesh.user.UserAccount;
import com.avshesh.user.UserDirectory;

/**
 * The household confirms that the money really arrived (or says it did not). The dealer enters the weight and the
 * amount alone, so this is the check that stops a dealer from recording a payment that was never made.
 */
@Service
public class PaymentConfirmationService {

    private final PickupStopRepository stops;
    private final PickupRepository pickups;
    private final ListingLookup listings;
    private final UserDirectory users;
    private final Notifier notifier;

    public PaymentConfirmationService(PickupStopRepository stops, PickupRepository pickups, ListingLookup listings,
                                      UserDirectory users, Notifier notifier) {
        this.stops = stops;
        this.pickups = pickups;
        this.listings = listings;
        this.users = users;
        this.notifier = notifier;
    }

    @Transactional
    public PaymentStatus respond(long householdId, long listingId, boolean received, String note) {
        UserAccount household = users.requireVerifiedRole(householdId, Role.HOUSEHOLD);
        ListingSummary listing = listings.get(listingId);
        if (!listing.ownerId().equals(householdId)) {
            throw ApiException.forbidden("PAYMENT_NOT_YOURS", "You can only answer for your own pickups");
        }
        PickupStop stop = stops.findFirstByListingId(listingId)
                .filter(PickupStop::isDone)
                .orElseThrow(() -> ApiException.badRequest("PAYMENT_NOT_DONE", "This pickup has not been collected yet"));
        if (stop.getPaymentStatus() != PaymentStatus.PENDING) {
            throw ApiException.conflict("PAYMENT_ALREADY", "You have already answered for this pickup");
        }
        String cleaned = note == null || note.isBlank() ? null : note.strip();
        if (!received && cleaned == null) {
            throw ApiException.badRequest("PAYMENT_NOTE_REQUIRED", "Please tell us what went wrong");
        }

        stop.setPaymentStatus(received ? PaymentStatus.CONFIRMED : PaymentStatus.DISPUTED);
        stop.setDisputeNote(received ? null : cleaned);
        stop.setConfirmedAt(LocalDateTime.now());
        stops.save(stop);

        if (!received) {
            Long dealerId = pickups.findById(stop.getPickupId()).orElseThrow().getCollectorId();
            notifier.notify(dealerId, "payment.disputed", household.name(), String.valueOf(stop.getAmountPaid()), cleaned);
        }
        return stop.getPaymentStatus();
    }
}
