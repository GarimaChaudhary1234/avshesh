package com.avshesh.common;

import ch.hsr.geohash.GeoHash;
import ch.hsr.geohash.WGS84Point;

public final class GeoUtil {

    /** Precision 6 is a cell of roughly 1.2 km x 0.6 km: one "mohalla". */
    private static final int MOHALLA_PRECISION = 6;
    private static final double EARTH_RADIUS_KM = 6371.0;

    private GeoUtil() {
    }

    public static String geohash(double lat, double lng) {
        return GeoHash.withCharacterPrecision(lat, lng, MOHALLA_PRECISION).toBase32();
    }

    /** Returns {lat, lng} of the centre of a geohash cell. */
    public static double[] center(String geohash) {
        WGS84Point p = GeoHash.fromGeohashString(geohash).getBoundingBoxCenter();
        return new double[] {p.getLatitude(), p.getLongitude()};
    }

    public static double distanceKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    public static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
