package com.avshesh.pool;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.avshesh.ratecard.Rate;

class MarginMinusTravelPolicyTest {

    private final MarginMinusTravelPolicy policy = new MarginMinusTravelPolicy();

    private static PoolItem item(String code, double kg) {
        return new PoolItem(1L, 1L, code, kg, LocalDate.now());
    }

    @Test
    void profitIsMarginMinusRoundTripCost() {
        Map<String, Rate> rates = Map.of("PET_BOTTLE", new Rate("PET_BOTTLE", 12, 18));
        // 10 kg x (18 - 12) = 60, minus 2 x 2 km x Rs 8 = 32
        assertEquals(28, policy.profit(List.of(item("PET_BOTTLE", 10)), rates, 2, 8), 1e-9);
    }

    @Test
    void itemsTheDealerDoesNotBuyAreIgnored() {
        Map<String, Rate> rates = Map.of("PET_BOTTLE", new Rate("PET_BOTTLE", 12, 18));
        assertEquals(30, policy.profit(List.of(item("PET_BOTTLE", 5), item("IRON_SCRAP", 100)), rates, 0, 8), 1e-9);
    }

    @Test
    void aFarAwayPoolCanBeALoss() {
        Map<String, Rate> rates = Map.of("PET_BOTTLE", new Rate("PET_BOTTLE", 12, 18));
        assertTrue(policy.profit(List.of(item("PET_BOTTLE", 1)), rates, 10, 8) < 0);
    }

    @Test
    void aHeavierVehicleCostsMore() {
        Map<String, Rate> rates = Map.of("PET_BOTTLE", new Rate("PET_BOTTLE", 12, 18));
        double cheap = policy.profit(List.of(item("PET_BOTTLE", 50)), rates, 3, 5);
        double dear = policy.profit(List.of(item("PET_BOTTLE", 50)), rates, 3, 12);
        assertEquals(42, cheap - dear, 1e-9);
    }

    @Test
    void anEmptyPoolOnlyHasTheTravelCost() {
        assertEquals(-16, policy.profit(List.of(), Map.of(), 1, 8), 1e-9);
    }

    @Test
    void poolItemTotalsCountWeightAndHouseholds() {
        List<PoolItem> items = List.of(new PoolItem(1L, 10L, "A", 2.5, LocalDate.now()),
                new PoolItem(2L, 10L, "B", 1.5, LocalDate.now()), new PoolItem(3L, 11L, "A", 4, LocalDate.now()));
        assertEquals(8, PoolItem.totalKg(items), 1e-9);
        assertEquals(2, PoolItem.households(items));
    }
}
