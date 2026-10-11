package com.avshesh.ratecard;

/** The best price a household can currently get nearby for an item. */
public record LocalRate(double rate, String collectorName, Long collectorId) {
}
