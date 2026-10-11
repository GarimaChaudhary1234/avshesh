package com.avshesh.security;

import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

import org.springframework.http.HttpHeaders;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Lets the login cookie act as a bearer token. It runs after the CSRF filter on purpose: Spring Security exempts
 * every request that "has a bearer token" from CSRF checks, so if the cookie were turned into a token any earlier,
 * cookie logins would silently skip the check.
 */
final class CookieToBearerFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Optional<String> cookie = request.getHeader(HttpHeaders.AUTHORIZATION) == null && !SecurityConfig.isPublicPath(request)
                ? AuthCookies.read(request) : Optional.empty();
        chain.doFilter(cookie.<HttpServletRequest>map(token -> new WithBearer(request, "Bearer " + token)).orElse(request), response);
    }

    private static final class WithBearer extends HttpServletRequestWrapper {
        private final String value;

        WithBearer(HttpServletRequest request, String value) {
            super(request);
            this.value = value;
        }

        @Override
        public String getHeader(String name) {
            return HttpHeaders.AUTHORIZATION.equalsIgnoreCase(name) ? value : super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            return HttpHeaders.AUTHORIZATION.equalsIgnoreCase(name) ? Collections.enumeration(Set.of(value)) : super.getHeaders(name);
        }

        @Override
        public Enumeration<String> getHeaderNames() {
            Set<String> names = new LinkedHashSet<>(Collections.list(super.getHeaderNames()));
            names.add(HttpHeaders.AUTHORIZATION);
            return Collections.enumeration(names);
        }
    }
}
