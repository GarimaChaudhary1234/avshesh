package com.avshesh.security;

import java.time.Duration;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

import com.avshesh.common.InMemoryRateLimiter;
import com.avshesh.common.RateLimiter;
import com.avshesh.common.RedisRateLimiter;
import com.avshesh.common.ResilientRateLimiter;

/**
 * Abuse limits. With {@code avshesh.limiter=redis} they are shared by every backend instance; otherwise they
 * are kept in memory of this instance. If Redis cannot be reached the limits fall back to per instance.
 */
@Configuration
public class LimiterConfig {

    private final ObjectProvider<StringRedisTemplate> redis;
    private final String mode;

    public LimiterConfig(ObjectProvider<StringRedisTemplate> redis, @Value("${avshesh.limiter:memory}") String mode) {
        this.redis = redis;
        this.mode = mode;
    }

    private RateLimiter limiter(String name, int max, Duration window) {
        RateLimiter local = new InMemoryRateLimiter(max, window);
        StringRedisTemplate template = "redis".equals(mode) ? redis.getIfAvailable() : null;
        return template == null ? local : new ResilientRateLimiter(name, new RedisRateLimiter(template, name, max, window), local);
    }

    /** Failed logins for one phone from one client. */
    @Bean("loginLimiter")
    RateLimiter loginLimiter() {
        return limiter("login", 8, Duration.ofMinutes(15));
    }

    /** Failed logins from one client across all phones (credential stuffing). */
    @Bean("loginClientLimiter")
    RateLimiter loginClientLimiter() {
        return limiter("login-client", 40, Duration.ofMinutes(15));
    }

    /** New accounts per client address per hour: stops fake accounts and a disk full of photos. */
    @Bean("registerLimiter")
    RateLimiter registerLimiter(@Value("${avshesh.register.limit-per-hour:60}") int perHour) {
        return limiter("register", perHour, Duration.ofHours(1));
    }

    /** Scans per household per hour: each one is a paid call to the AI model. */
    @Bean("scanLimiter")
    RateLimiter scanLimiter(@Value("${avshesh.scan.limit-per-hour:30}") int perHour) {
        return limiter("scan", perHour, Duration.ofHours(1));
    }

    /** SMS codes sent to one phone number per hour (each SMS costs money and can be used to annoy someone). */
    @Bean("smsPhoneLimiter")
    RateLimiter smsPhoneLimiter() {
        return limiter("sms-phone", 5, Duration.ofHours(1));
    }

    /** SMS codes requested from one client address per hour. */
    @Bean("smsClientLimiter")
    RateLimiter smsClientLimiter(@Value("${avshesh.sms.client-limit-per-hour:20}") int perHour) {
        return limiter("sms-client", perHour, Duration.ofHours(1));
    }

    /** Wrong SMS codes tried for one phone and purpose. */
    @Bean("smsGuessLimiter")
    RateLimiter smsGuessLimiter() {
        return limiter("sms-guess", 5, Duration.ofMinutes(15));
    }

    /** Moves of a user's home location: pool-hopping is not a legitimate need. */
    @Bean("locationLimiter")
    RateLimiter locationLimiter() {
        return limiter("location", 3, Duration.ofDays(1));
    }

    /** Address searches and ward lookups per client (the search is forwarded to a free public service). */
    @Bean("geoSearchLimiter")
    RateLimiter geoSearchLimiter() {
        return limiter("geo-search", 20, Duration.ofMinutes(1));
    }

    @Bean("geoWardLimiter")
    RateLimiter geoWardLimiter() {
        return limiter("geo-ward", 60, Duration.ofMinutes(1));
    }
}
