package com.avshesh.geo;

import java.util.List;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.avshesh.common.ApiException;
import com.avshesh.common.RateLimiter;
import com.avshesh.ward.WardDirectory;
import com.avshesh.ward.WardInfo;
import com.avshesh.ward.WardLocator;

import jakarta.servlet.http.HttpServletRequest;

/** Public helpers for choosing a home location: find a place by name and see which ward a pin falls in. */
@RestController
@RequestMapping("/api/v1/geo")
public class GeoController {

    /** {@code ward} is null when the point is outside every ward the app knows. */
    public record WardAt(boolean covered, WardInfo ward) {
    }

    private final GeoSearch search;
    private final WardLocator locator;
    private final WardDirectory wards;
    private final RateLimiter searchLimiter;
    private final RateLimiter wardLimiter;

    public GeoController(GeoSearch search, WardLocator locator, WardDirectory wards,
                         @Qualifier("geoSearchLimiter") RateLimiter searchLimiter,
                         @Qualifier("geoWardLimiter") RateLimiter wardLimiter) {
        this.search = search;
        this.locator = locator;
        this.wards = wards;
        this.searchLimiter = searchLimiter;
        this.wardLimiter = wardLimiter;
    }

    @GetMapping("/search")
    public List<Place> search(@RequestParam String q, HttpServletRequest http) {
        if (q.trim().length() < 3 || q.length() > 100) {
            throw ApiException.badRequest("GEO_QUERY_INVALID", "Type at least 3 letters to search");
        }
        if (!searchLimiter.tryAcquire(http.getRemoteAddr())) {
            throw ApiException.tooManyRequests("RATE_LIMITED", "Too many requests. Please slow down.");
        }
        return search.search(q);
    }

    /** A place name for a pin. Needs a login (it is used to tell a collector where a household is). */
    @GetMapping("/reverse")
    public java.util.Map<String, String> reverse(@RequestParam double lat, @RequestParam double lng, HttpServletRequest http) {
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            throw ApiException.badRequest("LOCATION_INVALID", "That location is outside India");
        }
        if (!searchLimiter.tryAcquire(http.getRemoteAddr())) {
            throw ApiException.tooManyRequests("RATE_LIMITED", "Too many requests. Please slow down.");
        }
        return java.util.Map.of("label", search.reverse(lat, lng).orElse(""));
    }

    @GetMapping("/ward")
    public WardAt ward(@RequestParam double lat, @RequestParam double lng, HttpServletRequest http) {
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            throw ApiException.badRequest("LOCATION_INVALID", "That location is outside India");
        }
        if (!wardLimiter.tryAcquire(http.getRemoteAddr())) {
            throw ApiException.tooManyRequests("RATE_LIMITED", "Too many requests. Please slow down.");
        }
        WardInfo ward = locator.wardIdAt(lat, lng).flatMap(wards::find).orElse(null);
        return new WardAt(ward != null, ward);
    }
}
