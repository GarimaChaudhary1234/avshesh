package com.avshesh.impact;

/** Sums computed by the database in one query. */
public record ImpactTotals(Double kgDiverted, Double kgRecycled, Double kgComposted, Double co2SavedKg,
                           Double paidToHouseholds, Long events, Long trips) {
}
