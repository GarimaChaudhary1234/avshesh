package com.avshesh.impact;

/** Read side of impact tracking, used by the public page and the municipal dashboard. */
public interface ImpactReader {

    /** @param area geohash prefix to narrow down to a neighbourhood, or null for the whole city */
    ImpactView summary(String area);

    /** @param wardId a single ward, or null for the whole city */
    ImpactView summaryForWard(Long wardId);

    /** The summary of every ward that has had a pickup, keyed by ward id. */
    java.util.Map<Long, ImpactView> summariesByWard();
}
