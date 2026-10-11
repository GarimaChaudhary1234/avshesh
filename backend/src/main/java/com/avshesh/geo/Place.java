package com.avshesh.geo;

/** One search hit: a readable name and where it is. */
public record Place(String label, double lat, double lng) {
}
