package com.avshesh.pickup;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.avshesh.security.CurrentUserId;
import com.avshesh.security.HouseholdOnly;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

/** The household's answer to "did you receive the money?". */
@RestController
@RequestMapping("/api/v1/listings")
@HouseholdOnly
public class PaymentConfirmationController {

    public record Answer(boolean received, @Size(max = 255) String note) {
    }

    public record Result(PaymentStatus status) {
    }

    private final PaymentConfirmationService service;

    public PaymentConfirmationController(PaymentConfirmationService service) {
        this.service = service;
    }

    @PostMapping("/{listingId}/payment")
    public Result answer(@CurrentUserId Long userId, @PathVariable long listingId, @Valid @RequestBody Answer body) {
        return new Result(service.respond(userId, listingId, body.received(), body.note()));
    }
}
