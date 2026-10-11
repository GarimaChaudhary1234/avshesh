package com.avshesh.pool;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.avshesh.pool.PoolQueryService.CollectorPoolRow;
import com.avshesh.pool.PoolQueryService.PoolView;
import com.avshesh.security.CollectorOnly;
import com.avshesh.security.CurrentUserId;
import com.avshesh.security.HouseholdOnly;

@RestController
@RequestMapping("/api/v1")
public class PoolController {

    private final PoolQueryService queries;

    public PoolController(PoolQueryService queries) {
        this.queries = queries;
    }

    @HouseholdOnly
    @GetMapping("/pools/mine")
    public List<PoolView> mine(@CurrentUserId Long userId) {
        return queries.poolsOfHousehold(userId);
    }

    @CollectorOnly
    @GetMapping("/collector/pools")
    public List<CollectorPoolRow> forCollector(@CurrentUserId Long userId) {
        return queries.poolsForCollector(userId);
    }
}
