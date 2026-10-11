package com.avshesh.impact;

import java.util.Map;

import org.springframework.stereotype.Component;

import com.avshesh.common.GeoUtil;
import com.avshesh.scan.Category;

/**
 * Demo assumptions, not measured emission factors: replace them with cited figures before they are
 * presented as fact.
 */
@Component
public class DefaultImpactMetrics implements ImpactMetrics {

    private static final Map<Category, Double> CO2_PER_KG = Map.of(
            Category.DRY, 1.5,
            Category.WET, 0.5,
            Category.GENERAL, 0.0,
            Category.HAZARDOUS, 0.0);

    /** Share of wet waste by weight that ends up as finished compost (about 1.2 t -> 300 kg). */
    private static final double COMPOST_YIELD = 0.25;

    @Override
    public double co2SavedKg(Category category, double kgDiverted) {
        return GeoUtil.round2(kgDiverted * CO2_PER_KG.getOrDefault(category, 0.0));
    }

    @Override
    public double compostedKg(Category category, double kgDiverted) {
        return category == Category.WET ? GeoUtil.round2(kgDiverted * COMPOST_YIELD) : 0;
    }
}
