package com.avshesh.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

class InMemoryRateLimiterTest {

    /** A clock the test can move forward. */
    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-10-08T10:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @Test
    void blocksOnceTheLimitIsReached() {
        InMemoryRateLimiter l = new InMemoryRateLimiter(3, Duration.ofMinutes(15), new MutableClock());
        for (int i = 0; i < 3; i++) {
            assertFalse(l.isBlocked("a"));
            l.record("a");
        }
        assertTrue(l.isBlocked("a"));
    }

    @Test
    void keysAreIndependent() {
        InMemoryRateLimiter l = new InMemoryRateLimiter(1, Duration.ofMinutes(15), new MutableClock());
        l.record("a");
        assertTrue(l.isBlocked("a"));
        assertFalse(l.isBlocked("b"));
    }

    @Test
    void theBlockEndsWhenTheWindowPasses() {
        MutableClock clock = new MutableClock();
        InMemoryRateLimiter l = new InMemoryRateLimiter(2, Duration.ofMinutes(10), clock);
        l.record("a");
        l.record("a");
        assertTrue(l.isBlocked("a"));
        clock.advance(Duration.ofMinutes(11));
        assertFalse(l.isBlocked("a"));
    }

    @Test
    void tryAcquireStopsAtTheLimit() {
        InMemoryRateLimiter l = new InMemoryRateLimiter(2, Duration.ofHours(1), new MutableClock());
        assertTrue(l.tryAcquire("u"));
        assertTrue(l.tryAcquire("u"));
        assertFalse(l.tryAcquire("u"));
    }

    @Test
    void clearForgetsTheKey() {
        InMemoryRateLimiter l = new InMemoryRateLimiter(1, Duration.ofMinutes(5), new MutableClock());
        l.record("a");
        l.clear("a");
        assertFalse(l.isBlocked("a"));
    }

    @Test
    void retryAfterCountsDownToTheOldestEvent() {
        MutableClock clock = new MutableClock();
        InMemoryRateLimiter l = new InMemoryRateLimiter(1, Duration.ofMinutes(10), clock);
        l.record("a");
        clock.advance(Duration.ofMinutes(4));
        assertEquals(6, l.retryAfter("a").toMinutes());
        assertEquals(Duration.ZERO, l.retryAfter("unknown"));
    }
}
