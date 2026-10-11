package com.avshesh.impact;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * How much waste people are estimated to produce, which is what "the share kept out of the dump" is measured
 * against. The per-person figure is an ASSUMPTION in the range that urban India reports (roughly 0.4 to 0.5 kg per
 * person per day), not a measurement of these wards: replace it with the municipal corporation's own figure.
 */
@Component
public class WasteBaseline {

    private final double kgPerPersonPerDay;

    public WasteBaseline(@Value("${avshesh.impact.kg-per-person-per-day:0.45}") double kgPerPersonPerDay) {
        this.kgPerPersonPerDay = kgPerPersonPerDay;
    }

    public double estimatedKg(double people, long days) {
        return people * kgPerPersonPerDay * Math.max(days, 1);
    }

    /** Share of the estimated waste that was kept out of the dump, 0 to 100, one decimal. */
    public static double percent(double keptKg, double estimatedKg) {
        if (estimatedKg <= 0) {
            return 0;
        }
        return Math.round(Math.min(100.0, keptKg / estimatedKg * 100) * 10) / 10.0;
    }
}
