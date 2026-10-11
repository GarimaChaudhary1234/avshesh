package com.avshesh.security;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

import com.avshesh.user.UserDirectory;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * A login token stays valid until it expires, so switching an account off must also be checked on every request.
 * The answer is remembered for a few seconds so this is not a database query per request.
 */
final class ActiveUserFilter extends OncePerRequestFilter {

    private static final long REMEMBER_MS = 5_000;

    private record Known(boolean active, long until) {
    }

    private final UserDirectory users;
    private final Map<Long, Known> known = new ConcurrentHashMap<>();

    ActiveUserFilter(UserDirectory users) {
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken jwt && jwt.getToken().getClaim("uid") instanceof Number uid
                && !isActive(uid.longValue())) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isActive(long userId) {
        long now = System.currentTimeMillis();
        Known k = known.get(userId);
        if (k == null || k.until() < now) {
            k = new Known(users.isActive(userId), now + REMEMBER_MS);
            known.put(userId, k);
        }
        return k.active();
    }
}
