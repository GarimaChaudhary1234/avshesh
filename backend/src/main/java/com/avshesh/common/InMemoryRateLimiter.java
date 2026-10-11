package com.avshesh.common;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** In memory, so it protects one backend instance. Used as the default and as the fallback when Redis is down. */
public final class InMemoryRateLimiter implements RateLimiter {

    private static final int CLEANUP_THRESHOLD = 10_000;

    private final int max;
    private final Duration window;
    private final Clock clock;
    private final Map<String, Deque<Instant>> events = new ConcurrentHashMap<>();

    public InMemoryRateLimiter(int max, Duration window) {
        this(max, window, Clock.systemUTC());
    }

    InMemoryRateLimiter(int max, Duration window, Clock clock) {
        this.max = max;
        this.window = window;
        this.clock = clock;
    }

    @Override
    public boolean isBlocked(String key) {
        Deque<Instant> q = events.get(key);
        if (q == null) {
            return false;
        }
        synchronized (q) {
            prune(q);
            return q.size() >= max;
        }
    }

    @Override
    public void record(String key) {
        if (events.size() > CLEANUP_THRESHOLD) {
            events.entrySet().removeIf(e -> {
                synchronized (e.getValue()) {
                    prune(e.getValue());
                    return e.getValue().isEmpty();
                }
            });
        }
        Deque<Instant> q = events.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            prune(q);
            q.addLast(clock.instant());
        }
    }

    @Override
    public boolean tryAcquire(String key) {
        Deque<Instant> q = events.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            prune(q);
            if (q.size() >= max) {
                return false;
            }
            q.addLast(clock.instant());
            return true;
        }
    }

    @Override
    public void clear(String key) {
        events.remove(key);
    }

    @Override
    public Duration retryAfter(String key) {
        Deque<Instant> q = events.get(key);
        if (q == null) {
            return Duration.ZERO;
        }
        synchronized (q) {
            prune(q);
            return q.isEmpty() ? Duration.ZERO : Duration.between(clock.instant(), q.peekFirst().plus(window));
        }
    }

    private void prune(Deque<Instant> q) {
        Instant cutoff = clock.instant().minus(window);
        while (!q.isEmpty() && q.peekFirst().isBefore(cutoff)) {
            q.pollFirst();
        }
    }
}
