package com.avshesh.common;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

/**
 * Sliding window kept in a Redis sorted set (score = time in ms), so every backend instance counts the same
 * events. Each operation is one Lua script, so the check and the write cannot be interleaved by another
 * instance. Time comes from Redis itself, so instances with different clocks agree.
 */
public final class RedisRateLimiter implements RateLimiter {

    private static final String NOW = "local t = redis.call('TIME') local now = t[1] * 1000 + math.floor(t[2] / 1000) ";
    private static final String PRUNE = "redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - tonumber(ARGV[2])) ";

    private static final DefaultRedisScript<Long> TRY_ACQUIRE = script(NOW + PRUNE
            + "if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[1]) then return 0 end "
            + "redis.call('ZADD', KEYS[1], now, ARGV[3]) redis.call('PEXPIRE', KEYS[1], ARGV[2]) return 1");

    private static final DefaultRedisScript<Long> RECORD = script(NOW + PRUNE
            + "redis.call('ZADD', KEYS[1], now, ARGV[3]) redis.call('PEXPIRE', KEYS[1], ARGV[2]) return 1");

    private static final DefaultRedisScript<Long> BLOCKED = script(NOW + PRUNE
            + "if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[1]) then return 1 end return 0");

    private static final DefaultRedisScript<Long> RETRY_AFTER_MS = script(NOW + PRUNE
            + "local first = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES') "
            + "if #first == 0 then return 0 end return tonumber(first[2]) + tonumber(ARGV[2]) - now");

    private final StringRedisTemplate redis;
    private final String prefix;
    private final int max;
    private final long windowMs;

    public RedisRateLimiter(StringRedisTemplate redis, String name, int max, Duration window) {
        this.redis = redis;
        this.prefix = "rl:" + name + ":";
        this.max = max;
        this.windowMs = window.toMillis();
    }

    private static DefaultRedisScript<Long> script(String lua) {
        return new DefaultRedisScript<>(lua, Long.class);
    }

    private List<String> keys(String key) {
        return List.of(prefix + key);
    }

    private Long run(DefaultRedisScript<Long> script, String key) {
        return redis.execute(script, keys(key), String.valueOf(max), String.valueOf(windowMs), UUID.randomUUID().toString());
    }

    @Override
    public boolean isBlocked(String key) {
        return Long.valueOf(1).equals(run(BLOCKED, key));
    }

    @Override
    public void record(String key) {
        run(RECORD, key);
    }

    @Override
    public boolean tryAcquire(String key) {
        return Long.valueOf(1).equals(run(TRY_ACQUIRE, key));
    }

    @Override
    public void clear(String key) {
        redis.delete(prefix + key);
    }

    @Override
    public Duration retryAfter(String key) {
        Long ms = run(RETRY_AFTER_MS, key);
        return ms == null || ms <= 0 ? Duration.ZERO : Duration.ofMillis(ms);
    }
}
