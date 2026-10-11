package com.avshesh.scan;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import com.avshesh.common.ApiException;
import com.avshesh.common.RateLimiter;
import com.avshesh.ratecard.LocalRate;
import com.avshesh.rating.RatingLookup;
import com.avshesh.rating.RatingSummary;
import com.avshesh.ratecard.RateLookup;
import com.avshesh.storage.PhotoStorage;
import com.avshesh.user.Role;
import com.avshesh.user.UserAccount;
import com.avshesh.user.UserDirectory;

@Service
public class ScanService {

    /** What the AI saw and where that waste has to go (see {@link Handling}). */
    public record ScanResult(String photoKey, String itemCode, String name, Category category, Handling handling,
                             double minRate, double maxRate, Double localRate, String localCollector,
                             Double collectorRating, int collectorRatingCount, String tip, double confidence) {
    }

    private final WasteScanner scanner;
    private final ItemCatalog catalog;
    private final RateLookup rates;
    private final UserDirectory users;
    private final PhotoStorage storage;
    private final RatingLookup ratings;
    private final RateLimiter scanLimiter;

    public ScanService(WasteScanner scanner, ItemCatalog catalog, RateLookup rates, UserDirectory users,
                       PhotoStorage storage, RatingLookup ratings,
                       @Qualifier("scanLimiter") RateLimiter scanLimiter) {
        this.scanner = scanner;
        this.catalog = catalog;
        this.rates = rates;
        this.users = users;
        this.storage = storage;
        this.ratings = ratings;
        this.scanLimiter = scanLimiter;
    }

    public ScanResult scan(long userId, byte[] image, String contentType, String hint) {
        UserAccount user = users.requireVerifiedRole(userId, Role.HOUSEHOLD);
        if (image.length == 0) {
            throw ApiException.badRequest("SCAN_EMPTY", "The photo is empty");
        }
        // Trust the bytes, not the file name or the header the client sent.
        String realType = ImageFormats.detect(image)
                .orElseThrow(() -> ApiException.badRequest("SCAN_BAD_FORMAT", "Please upload a JPEG, PNG, WEBP or GIF photo"));
        if (!scanLimiter.tryAcquire("user:" + userId)) {
            throw ApiException.tooManyRequests("SCAN_LIMIT", "You have reached the hourly scan limit. Please try again later.");
        }
        contentType = realType;
        WasteScanner.Detection d = scanner.detect(image, contentType, hint);
        WasteItem item = catalog.find(d.itemCode())
                .orElseThrow(() -> ApiException.badRequest("SCAN_UNIDENTIFIED", "Could not identify this item. Try a clearer photo of a single item."));
        String photoKey = storage.saveTemp(image, contentType);

        // Only waste that scrap dealers or compost centers buy has a local rate.
        Optional<LocalRate> local = item.category().isPoolable()
                ? rates.bestLocalRate(user, item.code()) : Optional.empty();
        RatingSummary rating = local.map(l -> ratings.forCollectors(java.util.List.of(l.collectorId()))
                .getOrDefault(l.collectorId(), RatingSummary.NONE)).orElse(RatingSummary.NONE);
        return new ScanResult(photoKey, item.code(), item.name(), item.category(), item.category().handling(),
                item.minRate(), item.maxRate(), local.map(LocalRate::rate).orElse(null),
                local.map(LocalRate::collectorName).orElse(null),
                rating.count() == 0 ? null : rating.average(), rating.count(), item.tip(), d.confidence());
    }
}
