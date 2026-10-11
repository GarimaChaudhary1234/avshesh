package com.avshesh.rating;

/** Average stars (rounded to one decimal) and how many households rated. */
public record RatingSummary(double average, int count) {

    public static final RatingSummary NONE = new RatingSummary(0, 0);
}
