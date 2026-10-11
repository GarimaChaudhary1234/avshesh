package com.avshesh.ratecard;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.common.GeoUtil;
import com.avshesh.scan.Category;
import com.avshesh.scan.ItemCatalog;
import com.avshesh.scan.WasteItem;
import com.avshesh.user.CollectorProfile;
import com.avshesh.user.CollectorSettingsUpdater;
import com.avshesh.user.Role;
import com.avshesh.user.UserAccount;
import com.avshesh.user.UserDirectory;

@Service
public class RateCardService implements RateLookup {

    public record RateItem(String itemCode, double buyRate, double sellRate) {
    }

    public record RateCardView(double serviceRadiusKm, double minTripProfit, double minLoadKg,
                               Double dailyCapacityKg, List<RateItem> items) {
    }

    private final RateCardRepository rateCards;
    private final UserDirectory users;
    private final CollectorSettingsUpdater settings;
    private final ItemCatalog catalog;

    public RateCardService(RateCardRepository rateCards, UserDirectory users, CollectorSettingsUpdater settings,
                           ItemCatalog catalog) {
        this.rateCards = rateCards;
        this.users = users;
        this.settings = settings;
        this.catalog = catalog;
    }

    @Transactional(readOnly = true)
    public RateCardView get(long collectorId) {
        CollectorProfile c = users.requireCollector(collectorId);
        List<RateItem> items = rateCards.findByCollectorId(collectorId).stream()
                .map(r -> new RateItem(r.getItemCode(), r.getBuyRate(), r.getSellRate())).toList();
        return new RateCardView(c.serviceRadiusKm(), c.minTripProfit(), c.minLoadKg(), c.dailyCapacityKg(), items);
    }

    @Transactional
    public RateCardView replace(long collectorId, RateCardView req) {
        Role role = users.requireCollector(collectorId).user().role();
        Category sells = role == Role.COMPOST ? Category.WET : Category.DRY;
        for (RateItem item : req.items()) {
            WasteItem known = catalog.find(item.itemCode())
                    .orElseThrow(() -> ApiException.badRequest("ITEM_UNKNOWN", "Unknown item"));
            if (known.category() != sells) {
                throw ApiException.badRequest(role == Role.COMPOST ? "RATE_WRONG_CATEGORY_COMPOST" : "RATE_WRONG_CATEGORY_DEALER",
                        "{0} cannot be priced by a " + (role == Role.COMPOST ? "compost center" : "scrap dealer"), known.name());
            }
            if (item.buyRate() < 0 || item.sellRate() < 0) {
                throw ApiException.badRequest("RATE_NEGATIVE", "Rates cannot be negative");
            }
        }
        settings.update(collectorId, req.serviceRadiusKm(), req.minTripProfit(), req.minLoadKg(),
                req.dailyCapacityKg());
        rateCards.deleteByCollectorId(collectorId);
        rateCards.flush();
        req.items().forEach(i -> rateCards.save(new RateCard(collectorId, i.itemCode(), i.buyRate(), i.sellRate())));
        return get(collectorId);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Rate> ratesOf(long collectorId) {
        Map<String, Rate> map = new HashMap<>();
        rateCards.findByCollectorId(collectorId)
                .forEach(r -> map.put(r.getItemCode(), new Rate(r.getItemCode(), r.getBuyRate(), r.getSellRate())));
        return map;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<LocalRate> bestLocalRate(UserAccount household, String itemCode) {
        LocalRate best = null;
        for (RateCard rc : rateCards.findByItemCode(itemCode)) {
            Optional<CollectorProfile> collector = users.findCollector(rc.getCollectorId()).filter(CollectorProfile::canWork);
            if (collector.isEmpty()) {
                continue;
            }
            UserAccount c = collector.get().user();
            double km = GeoUtil.distanceKm(household.lat(), household.lng(), c.lat(), c.lng());
            if (km <= collector.get().serviceRadiusKm() && (best == null || rc.getBuyRate() > best.rate())) {
                best = new LocalRate(rc.getBuyRate(), collector.get().displayName(), c.id());
            }
        }
        return Optional.ofNullable(best);
    }
}
