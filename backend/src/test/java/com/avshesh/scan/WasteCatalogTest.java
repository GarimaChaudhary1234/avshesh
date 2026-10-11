package com.avshesh.scan;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.avshesh.pool.WasteType;
import com.avshesh.user.Role;

class WasteCatalogTest {

    private final WasteCatalog catalog = new WasteCatalog();

    @Test
    void codesAreUniqueAndNamesAreEnglishText() {
        assertEquals(catalog.all().size(), catalog.all().stream().map(WasteItem::code).distinct().count());
        for (WasteItem i : catalog.all()) {
            assertTrue(i.name().matches("[\\x20-\\x7E]+"), "non-ASCII name: " + i.name());
            assertFalse(i.tip().isBlank(), i.code());
        }
    }

    @Test
    void everyKindOfWasteIsRepresented() {
        for (Category c : Category.values()) {
            assertTrue(catalog.all().stream().anyMatch(i -> i.category() == c), "no item for " + c);
        }
    }

    @Test
    void onlyWasteThatIsBoughtHasAPrice() {
        for (WasteItem i : catalog.all()) {
            if (i.category() == Category.DRY) {
                assertTrue(i.minRate() > 0 && i.maxRate() >= i.minRate(), i.code());
            }
            if (!i.category().isPoolable()) {
                assertEquals(0, i.maxRate(), i.code() + " must not have a market price");
            }
        }
    }

    @Test
    void wasteRoutesToTheRightPlace() {
        assertEquals(Handling.SELL_TO_DEALER, catalog.find("PET_BOTTLE").orElseThrow().category().handling());
        assertEquals(Handling.COMPOST, catalog.find("FOOD_WASTE").orElseThrow().category().handling());
        assertEquals(Handling.MUNICIPAL_PICKUP, catalog.find("DUST_SWEEPINGS").orElseThrow().category().handling());
        assertEquals(Handling.DROP_OFF_POINT, catalog.find("BATTERY").orElseThrow().category().handling());
    }

    @Test
    void onlyDryAndWetWasteCanBePooled() {
        assertTrue(Category.DRY.isPoolable());
        assertTrue(Category.WET.isPoolable());
        assertFalse(Category.GENERAL.isPoolable());
        assertFalse(Category.HAZARDOUS.isPoolable());
    }

    @Test
    void wasteTypesMapToTheRightCollectorRoles() {
        assertEquals(WasteType.DRY, WasteType.of(Category.DRY));
        assertEquals(WasteType.WET, WasteType.of(Category.WET));
        assertEquals(Role.KABADIWALA, WasteType.DRY.collectorRole());
        assertEquals(Role.COMPOST, WasteType.WET.collectorRole());
        assertEquals(WasteType.WET, WasteType.servedBy(Role.COMPOST));
        assertEquals(WasteType.DRY, WasteType.servedBy(Role.KABADIWALA));
    }

    @Test
    void unknownCodesAreNotFound() {
        assertTrue(catalog.find("LAPTOP").isEmpty());
        assertTrue(catalog.find(null).isEmpty());
    }
}
