package com.avshesh.rating;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.avshesh.rating.RatingService.CollectorRating;
import com.avshesh.rating.RatingService.MyRating;
import com.avshesh.rating.RatingService.NewRating;
import com.avshesh.security.CollectorOnly;
import com.avshesh.security.CurrentUserId;
import com.avshesh.security.HouseholdOnly;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1")
public class RatingController {

    private final RatingService service;

    public RatingController(RatingService service) {
        this.service = service;
    }

    @HouseholdOnly
    @PostMapping("/ratings")
    public MyRating create(@CurrentUserId Long userId, @Valid @RequestBody NewRating body) {
        return service.create(userId, body);
    }

    @HouseholdOnly
    @GetMapping("/ratings/mine")
    public List<MyRating> mine(@CurrentUserId Long userId) {
        return service.mine(userId);
    }

    @CollectorOnly
    @GetMapping("/collector/rating")
    public CollectorRating ofMe(@CurrentUserId Long userId) {
        return service.ofCollector(userId);
    }
}
