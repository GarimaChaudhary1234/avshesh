package com.avshesh.listing;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.common.GeoUtil;
import com.avshesh.pool.PoolService;
import com.avshesh.pool.WasteType;
import com.avshesh.ratecard.LocalRate;
import com.avshesh.ratecard.RateLookup;
import com.avshesh.scan.Category;
import com.avshesh.scan.Handling;
import com.avshesh.scan.ItemCatalog;
import com.avshesh.scan.WasteItem;
import com.avshesh.storage.PhotoStorage;
import com.avshesh.user.Role;
import com.avshesh.user.UserAccount;
import com.avshesh.user.UserDirectory;

@Service
public class ListingService {

    private static final double MAX_KG = 500;

    public record CreateRequest(String itemCode, double estKg, LocalDate readyFrom, ListingMode mode,
                                String photoKey) {
    }

    public record ListingView(Long id, String itemCode, String itemName, Category category, double estKg,
                              double estEarning, LocalDate readyFrom, ListingMode mode, ListingStatus status,
                              Long poolId, LocalDateTime pickupStart, LocalDateTime pickupEnd,
                              Double actualKg, Double amountPaid, String paymentStatus) {
    }

    private final ListingRepository listings;
    private final PoolService pools;
    private final RateLookup rates;
    private final UserDirectory users;
    private final ItemCatalog catalog;
    private final PickupInfoProvider pickupInfo;
    private final PhotoStorage photos;

    public ListingService(ListingRepository listings, PoolService pools, RateLookup rates, UserDirectory users,
                          ItemCatalog catalog, PickupInfoProvider pickupInfo, PhotoStorage photos) {
        this.listings = listings;
        this.pools = pools;
        this.rates = rates;
        this.users = users;
        this.catalog = catalog;
        this.pickupInfo = pickupInfo;
        this.photos = photos;
    }

    @Transactional
    public ListingView create(long userId, CreateRequest req) {
        UserAccount owner = users.requireVerifiedRole(userId, Role.HOUSEHOLD);
        WasteItem item = catalog.find(req.itemCode())
                .orElseThrow(() -> ApiException.badRequest("ITEM_UNKNOWN", "Unknown item"));
        if (!item.category().isPoolable()) {
            if (item.category().handling() == Handling.MUNICIPAL_PICKUP) {
                throw ApiException.badRequest("LISTING_NOT_RECYCLABLE",
                        "This waste is not recyclable. Ask the municipal corporation to collect it instead.");
            }
            throw ApiException.badRequest("LISTING_HAZARDOUS", "This is hazardous waste and cannot be sold.");
        }
        if (req.estKg() <= 0 || req.estKg() > MAX_KG) {
            throw ApiException.badRequest("LISTING_WEIGHT_RANGE", "Weight must be more than 0 and at most {0} kg", (int) MAX_KG);
        }

        if (req.readyFrom() != null && req.readyFrom().isBefore(LocalDate.now())) {
            throw ApiException.badRequest("LISTING_DATE_PAST", "The ready date cannot be in the past");
        }

        Listing l = new Listing();
        l.setOwnerId(owner.id());
        l.setItemCode(item.code());
        l.setCategory(item.category());
        l.setEstKg(req.estKg());
        l.setReadyFrom(req.readyFrom() != null ? req.readyFrom() : LocalDate.now());
        // The scan photo becomes permanent only now; an unknown or made-up key is simply dropped.
        l.setPhotoKey(req.photoKey() != null && photos.keep(req.photoKey()) ? req.photoKey() : null);
        l.setMode(req.mode() != null ? req.mode() : ListingMode.POOL);

        if (l.getMode() == ListingMode.POOL) {
            l.setPoolId(pools.assignPool(owner.lat(), owner.lng(), WasteType.of(item.category()), owner.wardId()));
        }
        l = listings.save(l);
        if (l.getPoolId() != null) {
            pools.refresh(l.getPoolId());
        }
        return view(l, owner, null);
    }

    @Transactional(readOnly = true)
    public List<ListingView> mine(long userId) {
        UserAccount owner = users.requireRole(userId, Role.HOUSEHOLD);
        List<Listing> mine = listings.findByOwnerIdOrderByIdDesc(userId);
        Map<Long, PickupInfo> infos = pickupInfo.forListings(mine.stream().map(Listing::getId).toList());
        return mine.stream().map(l -> view(l, owner, infos.get(l.getId()))).toList();
    }

    private ListingView view(Listing l, UserAccount owner, PickupInfo info) {
        WasteItem item = catalog.find(l.getItemCode()).orElseThrow();
        double rate = rates.bestLocalRate(owner, item.code()).map(LocalRate::rate).orElse(item.midRate());
        return new ListingView(l.getId(), item.code(), item.name(), l.getCategory(), l.getEstKg(),
                GeoUtil.round2(l.getEstKg() * rate), l.getReadyFrom(), l.getMode(), l.getStatus(), l.getPoolId(),
                info == null ? null : info.start(), info == null ? null : info.end(),
                info == null ? null : info.actualKg(), info == null ? null : info.amountPaid(),
                info == null ? null : info.paymentStatus());
    }
}
