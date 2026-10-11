package com.avshesh.common;

import java.time.Duration;

/**
 * Counts events per key inside a moving time window, e.g. "8 failed logins in 15 minutes".
 * Implementations: {@link InMemoryRateLimiter} (one backend instance) and {@link RedisRateLimiter}
 * (shared by every instance).
 */
public interface RateLimiter {

    /** True once the maximum number of events was recorded for this key inside the window. */
    boolean isBlocked(String key);

    void record(String key);

    /** Records an event unless the key is already over the limit. Returns false when it is. */
    boolean tryAcquire(String key);

    void clear(String key);

    /** How long until the oldest event leaves the window, for "try again in N minutes". */
    Duration retryAfter(String key);
}
