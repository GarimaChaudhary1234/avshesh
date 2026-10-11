package com.avshesh.geo;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import com.avshesh.common.ApiException;

/**
 * Address search through OpenStreetMap's free Nominatim service. Its usage policy asks for an identifying
 * User-Agent, at most one request per second and cached answers, so the browser never calls it directly: it asks
 * this backend, which caches results and is itself rate limited per client. Fine for a prototype; a busy
 * production service should use a paid geocoder or its own Nominatim.
 */
@Component
@ConditionalOnProperty(name = "avshesh.geo.provider", havingValue = "nominatim", matchIfMissing = true)
class NominatimGeoSearch implements GeoSearch {

    private static final Duration CACHE_TTL = Duration.ofMinutes(30);
    private static final int CACHE_MAX = 500;

    private record Cached(Instant at, List<Place> places) {
    }

    private final RestClient http;
    private final String url;
    private final String viewbox;
    private final Map<String, Cached> cache = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Cached> eldest) {
            return size() > CACHE_MAX;
        }
    };
    private Instant lastCall = Instant.EPOCH;

    NominatimGeoSearch(@Value("${avshesh.geo.nominatim-url}") String url,
                       @Value("${avshesh.geo.viewbox}") String viewbox,
                       @Value("${avshesh.geo.user-agent}") String userAgent) {
        this.url = url;
        this.viewbox = viewbox;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        this.http = RestClient.builder().requestFactory(factory).defaultHeader("User-Agent", userAgent).build();
    }

    @Override
    public List<Place> search(String query) {
        String key = query.trim().toLowerCase(Locale.ROOT);
        synchronized (cache) {
            Cached hit = cache.get(key);
            if (hit != null && hit.at().isAfter(Instant.now().minus(CACHE_TTL))) {
                return hit.places();
            }
        }
        throttle();
        List<Map<String, Object>> rows;
        try {
            rows = http.get()
                    .uri(UriComponentsBuilder.fromUriString(url)
                            .queryParam("format", "jsonv2").queryParam("q", "{q}").queryParam("limit", 5)
                            .queryParam("countrycodes", "in").queryParam("viewbox", viewbox).queryParam("bounded", 1)
                            .build(Map.of("q", query)))
                    .retrieve().body(new ParameterizedTypeReference<List<Map<String, Object>>>() { });
        } catch (RuntimeException e) {
            throw ApiException.badGateway("GEO_UNAVAILABLE",
                    "Address search is not available right now. Place the pin on the map instead.");
        }
        List<Place> places = new ArrayList<>();
        for (Map<String, Object> row : rows == null ? List.<Map<String, Object>>of() : rows) {
            try {
                places.add(new Place(String.valueOf(row.get("display_name")),
                        Double.parseDouble(String.valueOf(row.get("lat"))), Double.parseDouble(String.valueOf(row.get("lon")))));
            } catch (NumberFormatException ignored) {
                // a hit without usable coordinates is skipped
            }
        }
        synchronized (cache) {
            cache.put(key, new Cached(Instant.now(), places));
        }
        return places;
    }

    private final Map<String, String> names = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, String> eldest) {
            return size() > CACHE_MAX;
        }
    };

    @Override
    public java.util.Optional<String> reverse(double lat, double lng) {
        String key = String.format(Locale.ROOT, "%.4f,%.4f", lat, lng);
        synchronized (names) {
            if (names.containsKey(key)) {
                return java.util.Optional.ofNullable(names.get(key)).filter(s -> !s.isEmpty());
            }
        }
        throttle();
        String label = "";
        try {
            Map<String, Object> row = http.get()
                    .uri(UriComponentsBuilder.fromUriString(url.replace("/search", "/reverse"))
                            .queryParam("format", "jsonv2").queryParam("lat", lat).queryParam("lon", lng)
                            .queryParam("zoom", 18).queryParam("addressdetails", 1).build().toUri())
                    .retrieve().body(new ParameterizedTypeReference<Map<String, Object>>() { });
            label = shortName(row);
        } catch (RuntimeException e) {
            return java.util.Optional.empty();
        }
        synchronized (names) {
            names.put(key, label);
        }
        return java.util.Optional.of(label).filter(s -> !s.isEmpty());
    }

    /** "road, neighbourhood, city" from the structured address, instead of the whole postal line. */
    @SuppressWarnings("unchecked")
    private static String shortName(Map<String, Object> row) {
        if (row == null || !(row.get("address") instanceof Map<?, ?> raw)) {
            return "";
        }
        Map<String, Object> a = (Map<String, Object>) raw;
        List<String> parts = new ArrayList<>();
        for (String k : List.of("road", "neighbourhood", "suburb", "city_district", "city", "town", "village")) {
            Object v = a.get(k);
            if (v != null && !parts.contains(String.valueOf(v))) {
                parts.add(String.valueOf(v));
            }
            if (parts.size() == 3) {
                break;
            }
        }
        return String.join(", ", parts);
    }

    /** Nominatim allows one request per second: wait for the next free second instead of failing the user. */
    private synchronized void throttle() {
        long wait = Duration.between(Instant.now(), lastCall.plusMillis(1100)).toMillis();
        if (wait > 0) {
            try {
                Thread.sleep(wait);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        lastCall = Instant.now();
    }
}
