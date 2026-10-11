package com.avshesh.ward;

import java.util.ArrayList;
import java.util.List;

/** A ward boundary parsed for fast point-in-polygon checks. */
final class WardGeometry {

    private final Long wardId;
    private final double minLat;
    private final double maxLat;
    private final double minLng;
    private final double maxLng;
    private final double[][] outer;
    private final List<double[][]> holes;

    private WardGeometry(Long wardId, Ward w, double[][] outer, List<double[][]> holes) {
        this.wardId = wardId;
        this.minLat = w.getMinLat();
        this.maxLat = w.getMaxLat();
        this.minLng = w.getMinLng();
        this.maxLng = w.getMaxLng();
        this.outer = outer;
        this.holes = holes;
    }

    static WardGeometry of(Ward w) {
        String[] rings = w.getBoundary().split("\\|");
        double[][] outer = parseRing(rings[0]);
        List<double[][]> holes = new ArrayList<>();
        for (int i = 1; i < rings.length; i++) {
            holes.add(parseRing(rings[i]));
        }
        return new WardGeometry(w.getId(), w, outer, holes);
    }

    /** Parses "lng lat,lng lat,..." into {lng, lat} pairs. */
    static double[][] parseRing(String ring) {
        String[] points = ring.split(",");
        double[][] result = new double[points.length][2];
        for (int i = 0; i < points.length; i++) {
            String[] xy = points[i].trim().split(" ");
            result[i][0] = Double.parseDouble(xy[0]);
            result[i][1] = Double.parseDouble(xy[1]);
        }
        return result;
    }

    Long wardId() {
        return wardId;
    }

    boolean contains(double lat, double lng) {
        if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) {
            return false;
        }
        if (!inRing(outer, lat, lng)) {
            return false;
        }
        return holes.stream().noneMatch(h -> inRing(h, lat, lng));
    }

    /** Ray casting: a point is inside if a ray from it crosses the ring an odd number of times. */
    static boolean inRing(double[][] ring, double lat, double lng) {
        boolean inside = false;
        for (int i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            double xi = ring[i][0];
            double yi = ring[i][1];
            double xj = ring[j][0];
            double yj = ring[j][1];
            if ((yi > lat) != (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
                inside = !inside;
            }
        }
        return inside;
    }
}
