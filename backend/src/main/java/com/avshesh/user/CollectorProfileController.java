package com.avshesh.user;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.avshesh.security.CollectorOnly;
import com.avshesh.security.CurrentUserId;

import jakarta.validation.Valid;

/** A scrap dealer's or compost center's own business profile. */
@RestController
@RequestMapping("/api/v1/collector/profile")
@CollectorOnly
public class CollectorProfileController {

    private final UserDirectory users;
    private final CollectorProfileUpdater updater;

    public CollectorProfileController(UserDirectory users, CollectorProfileUpdater updater) {
        this.users = users;
        this.updater = updater;
    }

    @GetMapping
    public CollectorProfile get(@CurrentUserId Long userId) {
        return users.requireCollector(userId);
    }

    @PutMapping
    public CollectorProfile put(@CurrentUserId Long userId, @Valid @RequestBody CollectorBusinessProfile body) {
        users.requireCollector(userId);
        updater.update(userId, body);
        return users.requireCollector(userId);
    }
}
