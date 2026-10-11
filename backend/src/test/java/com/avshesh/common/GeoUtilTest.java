package com.avshesh.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class GeoUtilTest {

    @Test
    void distanceToItselfIsZero() {
        assertEquals(0, GeoUtil.distanceKm(20.3, 85.8, 20.3, 85.8), 1e-9);
    }

    @Test
    void bhubaneswarToCuttackIsAboutTwentySevenKm() {
        double km = GeoUtil.distanceKm(20.2961, 85.8245, 20.4625, 85.8830);
        assertTrue(km > 17 && km < 22, "got " + km);
    }

    @Test
    void distanceIsSymmetric() {
        assertEquals(GeoUtil.distanceKm(20.3, 85.8, 20.4, 85.9), GeoUtil.distanceKm(20.4, 85.9, 20.3, 85.8), 1e-9);
    }

    @Test
    void aOneThousandthOfADegreeOfLatitudeIsAboutOneHundredEleven() {
        assertEquals(0.111, GeoUtil.distanceKm(20.0, 85.0, 20.001, 85.0), 0.002);
    }

    @Test
    void geohashHasSixCharactersAndNeighboursShareIt() {
        String a = GeoUtil.geohash(20.305481, 85.797729);
        String b = GeoUtil.geohash(20.3058, 85.7979);
        assertEquals(6, a.length());
        assertEquals(a, b);
    }

    @Test
    void farApartPlacesHaveDifferentGeohashes() {
        assertTrue(!GeoUtil.geohash(20.3, 85.8).equals(GeoUtil.geohash(20.4, 85.8)));
    }

    @Test
    void cellCentreIsInsideItsOwnCell() {
        double[] c = GeoUtil.center(GeoUtil.geohash(20.305481, 85.797729));
        assertEquals(GeoUtil.geohash(20.305481, 85.797729), GeoUtil.geohash(c[0], c[1]));
    }

    @Test
    void round2KeepsTwoDecimals() {
        assertEquals(64.8, GeoUtil.round2(64.800000001), 0);
        assertEquals(0.13, GeoUtil.round2(0.125), 0.0001);
    }
}
