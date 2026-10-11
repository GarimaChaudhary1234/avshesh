package com.avshesh.geo;

import java.util.List;
import java.util.Locale;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Offline stand-in used by the automated tests (avshesh.geo.provider=static): a few fixed Bhubaneswar places. */
@Component
@ConditionalOnProperty(name = "avshesh.geo.provider", havingValue = "static")
class StaticGeoSearch implements GeoSearch {

    private static final List<Place> PLACES = List.of(
            new Place("Saheed Nagar, Bhubaneswar, Odisha", 20.2961, 85.8420),
            new Place("Jaydev Vihar, Bhubaneswar, Odisha", 20.2975, 85.8195),
            new Place("Patia, Bhubaneswar, Odisha", 20.3540, 85.8190),
            new Place("Ward 15 demo mohalla, Bhubaneswar, Odisha", 20.305481, 85.797729));

    @Override
    public java.util.Optional<String> reverse(double lat, double lng) {
        return PLACES.stream().filter(p -> com.avshesh.common.GeoUtil.distanceKm(lat, lng, p.lat(), p.lng()) < 1.0)
                .map(Place::label).findFirst();
    }

    @Override
    public List<Place> search(String query) {
        String q = query.trim().toLowerCase(Locale.ROOT);
        return PLACES.stream().filter(p -> p.label().toLowerCase(Locale.ROOT).contains(q)).toList();
    }
}
