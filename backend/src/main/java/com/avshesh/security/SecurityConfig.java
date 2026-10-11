package com.avshesh.security;

import java.util.List;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Stateless JWT security. Public: auth, public impact page, catalog, health. Everything else needs a
 * valid token; per-role rules sit on the controllers as {@code @PreAuthorize}.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, com.avshesh.user.UserDirectory userDirectory,
                                    @Qualifier("corsConfigurationSource") CorsConfigurationSource cors,
                                    @Value("${management.server.port:-1}") int managementPort,
                                    @Value("${server.port:8080}") int serverPort)
            throws Exception {
        // Metrics are only opened up when Actuator runs on its own internal port, which docker does not publish.
        boolean internalMetrics = managementPort > 0 && managementPort != serverPort;
        // Cookie logins need CSRF protection: SameSite=Strict already blocks cross-site requests, and the
        // double-submit token (XSRF-TOKEN cookie echoed in X-XSRF-TOKEN) is a second wall. Requests that carry
        // an Authorization header cannot be forged by another site, so they are exempt.
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        http.csrf(c -> c.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(csrfHandler)
                        // By default Spring throws the CSRF cookie away on every authenticated request (it expects a new
                        // session after a login). Here there are no sessions, so the token must stay until logout.
                        .sessionAuthenticationStrategy((authentication, request, response) -> { })
                        .requireCsrfProtectionMatcher(SecurityConfig::needsCsrfCheck))
                .addFilterAfter(new CsrfCookieFilter(), BasicAuthenticationFilter.class)
                .addFilterAfter(new CookieToBearerFilter(), CsrfFilter.class)
                .addFilterAfter(new ActiveUserFilter(userDirectory), org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter.class)
                .cors(c -> c.configurationSource(cors))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/v1/geo/reverse").authenticated()
                        .requestMatchers(internalMetrics ? new String[] {"/actuator/prometheus", "/actuator/metrics/**", "/actuator/info"} : new String[] {"/actuator/none"}).permitAll()
                        // Spring forwards failures (bad JSON, validation errors) to /error. If that page needs a login,
                        // an anonymous caller of a public endpoint gets 401 instead of the real 400.
                        .requestMatchers("/error", "/api/v1/auth/**", "/api/v1/impact/**", "/api/v1/catalog",
                                "/api/v1/scan/mode", "/api/v1/health", "/api/v1/geo/**", "/actuator/health/**").permitAll()
                        // Roles are checked here, before the request body is even read. The @HouseholdOnly,
                        // @CollectorOnly and @MunicipalOnly annotations on the controllers are a second layer.
                        .requestMatchers("/api/v1/municipal/**").hasRole("MUNICIPAL")
                        .requestMatchers("/api/v1/staff/**").hasRole("FIELD_STAFF")
                        .requestMatchers("/api/v1/collector/**", "/api/v1/pools/*/accept", "/api/v1/pickups/**")
                                .hasAnyRole("KABADIWALA", "COMPOST")
                        .requestMatchers("/api/v1/home", "/api/v1/scan", "/api/v1/listings/**", "/api/v1/pools/mine",
                                "/api/v1/municipal-requests/**", "/api/v1/collection-points/**", "/api/v1/ratings/**")
                                .hasRole("HOUSEHOLD")
                        .anyRequest().authenticated())
                .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .oauth2ResourceServer(o -> o
                        .jwt(j -> j.jwtAuthenticationConverter(jwtConverter())));
        return http.build();
    }

    private static final List<String> PUBLIC_PREFIXES = List.of("/error", "/api/v1/auth/", "/api/v1/impact",
            "/api/v1/catalog", "/api/v1/scan/mode", "/api/v1/health", "/api/v1/geo", "/actuator/health");

    static boolean isPublicPath(HttpServletRequest request) {
        String path = request.getRequestURI();
        // The place-name lookup sits under the public /geo prefix but needs a login: the cookie must count there.
        if (path.startsWith("/api/v1/geo/reverse")) {
            return false;
        }
        return PUBLIC_PREFIXES.stream().anyMatch(path::startsWith);
    }

    /** Only state-changing requests that are authenticated by the cookie alone can be forged by another site. */
    private static boolean needsCsrfCheck(HttpServletRequest request) {
        boolean unsafe = !List.of("GET", "HEAD", "OPTIONS", "TRACE").contains(request.getMethod());
        return unsafe && request.getHeader("Authorization") == null && AuthCookies.read(request).isPresent()
                && !isPublicPath(request);
    }

    /** Turns the "role" claim into the ROLE_HOUSEHOLD / ROLE_KABADIWALA / ROLE_COMPOST authority. */
    private JwtAuthenticationConverter jwtConverter() {
        JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthoritiesClaimName("role");
        authorities.setAuthorityPrefix("ROLE_");
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authorities);
        return converter;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${avshesh.cors.allowed-origins}") List<String> allowedOrigins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-XSRF-TOKEN", "Accept-Language"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
