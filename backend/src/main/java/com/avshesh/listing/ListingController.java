package com.avshesh.listing;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.avshesh.listing.HomeService.HomeView;
import com.avshesh.listing.ListingService.CreateRequest;
import com.avshesh.listing.ListingService.ListingView;
import com.avshesh.security.CurrentUserId;
import com.avshesh.security.HouseholdOnly;

@RestController
@RequestMapping("/api/v1")
@HouseholdOnly
public class ListingController {

    private final ListingService listings;
    private final HomeService home;

    public ListingController(ListingService listings, HomeService home) {
        this.listings = listings;
        this.home = home;
    }

    @PostMapping("/listings")
    public ListingView create(@CurrentUserId Long userId, @RequestBody CreateRequest req) {
        return listings.create(userId, req);
    }

    @GetMapping("/listings/mine")
    public List<ListingView> mine(@CurrentUserId Long userId) {
        return listings.mine(userId);
    }

    @GetMapping("/home")
    public HomeView home(@CurrentUserId Long userId) {
        return home.home(userId);
    }
}
