package com.avshesh.scan;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Component;

/**
 * Items the AI can recognise. The scanner may only answer with one of these codes, so every
 * result has a known category (and so a known destination) and price range. Rates are placeholders
 * to be verified locally.
 */
@Component
public class WasteCatalog implements ItemCatalog {

    private final List<WasteItem> items = List.of(
            // Dry: sold to a scrap dealer
            new WasteItem("PET_BOTTLE", "Plastic Bottle (PET)", Category.DRY, 10, 14,
                    "Remove the cap and label separately for a better rate"),
            new WasteItem("NEWSPAPER", "Newspaper / Waste Paper", Category.DRY, 12, 16,
                    "Keep it dry: wet paper fetches a much lower rate"),
            new WasteItem("CARDBOARD", "Cardboard / Cartons", Category.DRY, 6, 9,
                    "Flatten the boxes so they take less space"),
            new WasteItem("IRON_SCRAP", "Iron Scrap", Category.DRY, 28, 35,
                    "Separate it and remove any plastic or wood attached"),
            new WasteItem("ALUMINIUM_CAN", "Aluminium Can", Category.DRY, 90, 110,
                    "Empty and crush the cans to save space"),
            new WasteItem("GLASS_BOTTLE", "Glass Bottle", Category.DRY, 2, 5,
                    "Keep broken glass in a separate box and handle with care"),
            // Wet: composted
            new WasteItem("FOOD_WASTE", "Food Waste (Vegetable / Fruit Peels)", Category.WET, 0, 1,
                    "Do not put it in plastic bags: keep it in a bin"),
            // General: not recyclable, collected by the municipal corporation
            new WasteItem("DUST_SWEEPINGS", "Dust / Sweepings", Category.GENERAL, 0, 0,
                    "Not recyclable. Keep it in a closed bag and hand it to the municipal waste collector"),
            new WasteItem("MIXED_WASTE", "Mixed / Soiled Waste", Category.GENERAL, 0, 0,
                    "Dirty or mixed waste cannot be recycled. Use the municipal collection"),
            new WasteItem("SANITARY_WASTE", "Sanitary / Diaper Waste", Category.GENERAL, 0, 0,
                    "Wrap it in paper and mark it 'sanitary' before handing it over"),
            new WasteItem("THERMOCOL", "Thermocol / Multilayer Packaging", Category.GENERAL, 0, 0,
                    "Scrap dealers rarely accept it. Hand it to the municipal collector"),
            // Hazardous: only to an authorised drop-off point
            new WasteItem("BATTERY", "Battery", Category.HAZARDOUS, 0, 0,
                    "Do not give to a scrap dealer: hand it in at an authorised drop-off point"),
            new WasteItem("BULB", "Bulb / CFL / Tube Light", Category.HAZARDOUS, 0, 0,
                    "Do not give to a scrap dealer: broken tubes can release mercury"),
            new WasteItem("MEDICINE", "Expired Medicine", Category.HAZARDOUS, 0, 0,
                    "Do not give to a scrap dealer: return it to a pharmacy or a drop-off point"),
            new WasteItem("E_WASTE", "Electronic Waste (phone, charger, wires)", Category.HAZARDOUS, 0, 0,
                    "Do not give to a scrap dealer: hand it in at an authorised e-waste drop-off point"));

    @Override
    public List<WasteItem> all() {
        return items;
    }

    @Override
    public Optional<WasteItem> find(String code) {
        return items.stream().filter(i -> i.code().equals(code)).findFirst();
    }
}
