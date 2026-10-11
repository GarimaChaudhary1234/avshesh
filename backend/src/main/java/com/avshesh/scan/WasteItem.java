package com.avshesh.scan;

/** One entry of the waste catalog. Rates are indicative market ranges in Rs/kg. */
public record WasteItem(String code, String name, Category category, double minRate, double maxRate,
                        String tip) {

    public double midRate() {
        return (minRate + maxRate) / 2;
    }
}
