package com.avshesh.common;

import java.time.Duration;
import java.util.function.Function;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Uses the shared limiter, and quietly falls back to a local one if it cannot be reached, so a Redis outage
 * degrades the limits to "per instance" instead of breaking login or scanning.
 */
public final class ResilientRateLimiter implements RateLimiter {

    private static final Logger log = LoggerFactory.getLogger(ResilientRateLimiter.class);

    private final RateLimiter primary;
    private final RateLimiter fallback;
    private final String name;

    public ResilientRateLimiter(String name, RateLimiter primary, RateLimiter fallback) {
        this.name = name;
        this.primary = primary;
        this.fallback = fallback;
    }

    private <T> T call(Function<RateLimiter, T> op) {
        try {
            return op.apply(primary);
        } catch (RuntimeException e) {
            log.warn("Shared rate limiter '{}' is unavailable, using the local one: {}", name, e.getMessage());
            return op.apply(fallback);
        }
    }

    @Override
    public boolean isBlocked(String key) {
        return call(l -> l.isBlocked(key));
    }

    @Override
    public void record(String key) {
        call(l -> {
            l.record(key);
            return null;
        });
    }

    @Override
    public boolean tryAcquire(String key) {
        return call(l -> l.tryAcquire(key));
    }

    @Override
    public void clear(String key) {
        call(l -> {
            l.clear(key);
            return null;
        });
    }

    @Override
    public Duration retryAfter(String key) {
        return call(l -> l.retryAfter(key));
    }
}
