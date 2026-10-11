package com.avshesh.impact;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;


/** Public: no login, used by the municipality view and the demo. */
@RestController
@RequestMapping("/api/v1/impact")
public class ImpactController {

    private final ImpactReader service;

    public ImpactController(ImpactReader service) {
        this.service = service;
    }

    @GetMapping
    public ImpactView impact(@RequestParam(value = "area", required = false) String area) {
        return service.summary(area);
    }
}
