package com.avshesh.pickup;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.avshesh.pickup.EarningsService.Earnings;
import com.avshesh.pickup.PickupQueryService.PickupView;
import com.avshesh.pickup.StopCompletionService.StopResult;
import com.avshesh.security.CollectorOnly;
import com.avshesh.security.CurrentUserId;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

@RestController
@RequestMapping("/api/v1")
@CollectorOnly
public class PickupController {

    public record AcceptRequest(@NotNull LocalDateTime start, @NotNull LocalDateTime end) {
    }

    public record CompleteRequest(@Positive double actualKg, @NotNull PaymentMode paymentMode) {
    }

    private final PickupScheduler scheduler;
    private final PickupQueryService queries;
    private final StopCompletionService completion;
    private final EarningsService earnings;

    public PickupController(PickupScheduler scheduler, PickupQueryService queries, StopCompletionService completion,
                            EarningsService earnings) {
        this.scheduler = scheduler;
        this.queries = queries;
        this.completion = completion;
        this.earnings = earnings;
    }

    @PostMapping("/pools/{poolId}/accept")
    public PickupView accept(@CurrentUserId Long userId, @PathVariable long poolId,
                             @Valid @RequestBody AcceptRequest req) {
        return scheduler.accept(userId, poolId, req.start(), req.end());
    }

    @GetMapping("/collector/pickups")
    public List<PickupView> mine(@CurrentUserId Long userId) {
        return queries.mine(userId);
    }

    @GetMapping("/pickups/{id}/route")
    public PickupView route(@CurrentUserId Long userId, @PathVariable long id) {
        return queries.route(userId, id);
    }

    @PostMapping("/pickups/stops/{stopId}/complete")
    public StopResult complete(@CurrentUserId Long userId, @PathVariable long stopId,
                               @Valid @RequestBody CompleteRequest req) {
        return completion.complete(userId, stopId, req.actualKg(), req.paymentMode());
    }

    @GetMapping("/collector/earnings")
    public Earnings earnings(@CurrentUserId Long userId, @RequestParam(value = "days", defaultValue = "7") @Min(1) @Max(365) int days) {
        return earnings.earnings(userId, days);
    }
}
