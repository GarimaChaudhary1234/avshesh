package com.avshesh.municipal;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.avshesh.municipal.CollectionPointService.PointView;
import com.avshesh.municipal.MunicipalRequestService.HouseholdView;
import com.avshesh.municipal.MunicipalRequestService.NewRequest;
import com.avshesh.security.CurrentUserId;
import com.avshesh.security.HouseholdOnly;

import jakarta.validation.Valid;

/** The household's side of the municipal corporation: ask for a pickup, find a drop-off point. */
@RestController
@RequestMapping("/api/v1")
@HouseholdOnly
public class CitizenMunicipalController {

    private final MunicipalRequestService requests;
    private final CollectionPointService points;

    public CitizenMunicipalController(MunicipalRequestService requests, CollectionPointService points) {
        this.requests = requests;
        this.points = points;
    }

    @PostMapping("/municipal-requests")
    public HouseholdView create(@CurrentUserId Long userId, @Valid @RequestBody NewRequest body) {
        return requests.create(userId, body);
    }

    @GetMapping("/municipal-requests/mine")
    public List<HouseholdView> mine(@CurrentUserId Long userId) {
        return requests.mine(userId);
    }

    @GetMapping("/collection-points/nearby")
    public List<PointView> nearby(@CurrentUserId Long userId) {
        return points.nearby(userId);
    }
}
