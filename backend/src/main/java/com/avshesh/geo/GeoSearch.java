package com.avshesh.geo;

import java.util.List;

/** Turns what a person types ("Saheed Nagar") into places on the map. */
public interface GeoSearch {

    /** Up to a few matching places inside the area the app serves. Throws a 502 ApiException if the provider is down. */
    List<Place> search(String query);

    /** A short readable place name for a point ("Jaydev Vihar, Bhubaneswar"), or empty when none is known. */
    java.util.Optional<String> reverse(double lat, double lng);
}
