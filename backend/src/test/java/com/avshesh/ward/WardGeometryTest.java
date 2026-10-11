package com.avshesh.ward;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import com.avshesh.user.AccountService;

/** Checks the real Bhubaneswar ward file and the point-in-polygon logic built on it. */
class WardGeometryTest {

    private static final List<Ward> WARDS = new ArrayList<>();
    private static final List<WardGeometry> GEOMETRIES = new ArrayList<>();

    @BeforeAll
    static void load() throws Exception {
        try (BufferedReader in = new BufferedReader(new InputStreamReader(
                WardGeometryTest.class.getResourceAsStream("/data/bhubaneswar-wards.tsv"), StandardCharsets.UTF_8))) {
            String line;
            long id = 0;
            while ((line = in.readLine()) != null) {
                if (line.isBlank() || line.startsWith("#")) {
                    continue;
                }
                String[] cols = line.split("\t");
                Ward w = new Ward();
                w.setId(++id);
                w.setCity("Bhubaneswar");
                w.setWardNo(cols[0]);
                w.setZone(cols[1]);
                w.setBoundary(cols[4]);
                double minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
                for (double[] p : WardGeometry.parseRing(cols[4].split("\\|")[0])) {
                    minLng = Math.min(minLng, p[0]);
                    maxLng = Math.max(maxLng, p[0]);
                    minLat = Math.min(minLat, p[1]);
                    maxLat = Math.max(maxLat, p[1]);
                }
                w.setMinLat(minLat);
                w.setMaxLat(maxLat);
                w.setMinLng(minLng);
                w.setMaxLng(maxLng);
                WARDS.add(w);
                GEOMETRIES.add(WardGeometry.of(w));
            }
        }
    }

    @Test
    void fileHasAllSixtySevenWardsWithUniqueNumbers() {
        assertEquals(67, WARDS.size());
        assertEquals(67, WARDS.stream().map(Ward::getWardNo).distinct().count());
    }

    @Test
    void everyWardIsInsideBhubaneswar() {
        for (Ward w : WARDS) {
            assertTrue(w.getMinLat() > 20.1 && w.getMaxLat() < 20.4, w.getWardNo() + " latitude");
            assertTrue(w.getMinLng() > 85.7 && w.getMaxLng() < 85.95, w.getWardNo() + " longitude");
        }
    }

    @Test
    void aPointInsideAWardIsFoundInThatWardOnly() {
        int checked = 0;
        for (int i = 0; i < GEOMETRIES.size(); i++) {
            Ward w = WARDS.get(i);
            double[][] ring = WardGeometry.parseRing(w.getBoundary().split("\\|")[0]);
            double lat = 0;
            double lng = 0;
            for (double[] p : ring) {
                lng += p[0];
                lat += p[1];
            }
            lat /= ring.length;
            lng /= ring.length;
            if (!GEOMETRIES.get(i).contains(lat, lng)) {
                continue; // a concave ward whose vertex average falls outside it: skip this sample
            }
            checked++;
            for (int j = 0; j < GEOMETRIES.size(); j++) {
                assertEquals(i == j, GEOMETRIES.get(j).contains(lat, lng),
                        "point of " + w.getWardNo() + " tested against " + WARDS.get(j).getWardNo());
            }
        }
        assertTrue(checked >= 50, "only " + checked + " wards produced a usable interior sample");
    }

    @Test
    void theDemoMohallaIsInsideWard15() {
        Ward demo = null;
        for (int i = 0; i < GEOMETRIES.size(); i++) {
            if (GEOMETRIES.get(i).contains(AccountService.DEFAULT_LAT, AccountService.DEFAULT_LNG)) {
                demo = WARDS.get(i);
            }
        }
        assertNotNull(demo);
        assertEquals("W15", demo.getWardNo());
    }

    @Test
    void placesOutsideTheCityAreInNoWard() {
        for (WardGeometry g : GEOMETRIES) {
            assertFalse(g.contains(28.58, 77.32), "Noida must not be in a Bhubaneswar ward");
            assertFalse(g.contains(0, 0));
            assertFalse(g.contains(20.9, 85.8), "well north of the city");
        }
    }

    @Test
    void aHoleIsNotPartOfTheWard() {
        String outer = "0 0,0 10,10 10,10 0,0 0";
        String hole = "4 4,4 6,6 6,6 4,4 4";
        Ward w = new Ward();
        w.setId(1L);
        w.setBoundary(outer + "|" + hole);
        w.setMinLng(0);
        w.setMaxLng(10);
        w.setMinLat(0);
        w.setMaxLat(10);
        WardGeometry g = WardGeometry.of(w);
        assertTrue(g.contains(2, 2));
        assertFalse(g.contains(5, 5), "inside the hole");
        assertFalse(g.contains(11, 5));
    }
}
