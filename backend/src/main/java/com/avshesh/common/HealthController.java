package com.avshesh.common;

import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * A tiny "is the app up?" endpoint on the public port for load balancers and App Runner. It answers 503 until the
 * application has finished starting, including the demo data seeding: the web server accepts requests slightly
 * before start-up runners have finished, and a health check must not call a half-started app healthy.
 * The Actuator endpoints (metrics, Prometheus) are served on a separate internal port that is not published.
 */
@RestController
@RequestMapping("/api/v1/health")
public class HealthController {

    private final AtomicBoolean ready = new AtomicBoolean(false);

    @EventListener(ApplicationReadyEvent.class)
    void markReady() {
        ready.set(true);
    }

    @GetMapping
    public ResponseEntity<Map<String, String>> health() {
        if (!ready.get()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("status", "STARTING"));
        }
        return ResponseEntity.ok(Map.of("status", "UP"));
    }
}
