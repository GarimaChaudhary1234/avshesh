package com.avshesh.security;

import java.time.Duration;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * The login token travels in an HttpOnly, SameSite=Strict cookie. JavaScript cannot read it, so a script injected
 * into the page cannot steal it. API clients may still send it as an {@code Authorization: Bearer} header.
 */
@Component
public class AuthCookies {

    public static final String NAME = "avshesh_token";

    private final boolean secure;
    private final Duration ttl;

    public AuthCookies(@Value("${avshesh.cookie.secure:false}") boolean secure,
                       @Value("${avshesh.jwt.ttl-hours}") long ttlHours) {
        this.secure = secure;
        this.ttl = Duration.ofHours(ttlHours);
    }

    public void write(HttpServletResponse response, String token) {
        response.addHeader(HttpHeaders.SET_COOKIE, build(token, ttl).toString());
    }

    public void clear(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, build("", Duration.ZERO).toString());
    }

    private ResponseCookie build(String value, Duration maxAge) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Strict")
                .path("/")
                .maxAge(maxAge)
                .build();
    }

    public static Optional<String> read(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        for (Cookie c : cookies) {
            if (NAME.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                return Optional.of(c.getValue());
            }
        }
        return Optional.empty();
    }
}
