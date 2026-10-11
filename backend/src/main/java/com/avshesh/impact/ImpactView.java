package com.avshesh.impact;

/**
 * @param pickups            completed pickups (trips: one dealer round collecting from several homes counts once)
 * @param collections        homes collected from (stops): a pickup of three homes is three collections
 * @param estimatedWasteKg waste the covered population is estimated to have produced since the first pickup
 * @param keptFromDumpPercent share of that estimate that was kept out of the dump; null when the area has no
 *                            population figure (a map-cell area rather than a ward or the whole city)
 */
public record ImpactView(String area, double kgDiverted, double kgRecycled, double kgComposted,
                         double co2SavedKg, double paidToHouseholds, int pickups,
                         int collections, double estimatedWasteKg, Double keptFromDumpPercent) {
}
