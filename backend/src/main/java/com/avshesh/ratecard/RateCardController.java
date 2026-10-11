package com.avshesh.ratecard;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.avshesh.ratecard.RateCardService.RateCardView;
import com.avshesh.security.CollectorOnly;
import com.avshesh.security.CurrentUserId;

@RestController
@RequestMapping("/api/v1/collector/rate-card")
@CollectorOnly
public class RateCardController {

    private final RateCardService service;

    public RateCardController(RateCardService service) {
        this.service = service;
    }

    @GetMapping
    public RateCardView get(@CurrentUserId Long userId) {
        return service.get(userId);
    }

    @PutMapping
    public RateCardView put(@CurrentUserId Long userId, @RequestBody RateCardView body) {
        return service.replace(userId, body);
    }
}
