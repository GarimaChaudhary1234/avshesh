package com.avshesh.municipal;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.avshesh.municipal.MunicipalCityService.CityView;
import com.avshesh.municipal.MunicipalCityService.OfficerRow;
import com.avshesh.municipal.MunicipalCityService.WardDetail;
import com.avshesh.security.CurrentUserId;
import com.avshesh.security.MunicipalOnly;
import com.avshesh.user.OfficerDirectory;
import com.avshesh.user.OfficerDirectory.Officer;
import com.avshesh.ward.WardDirectory;
import com.avshesh.ward.WardInfo;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * The commissioner's side of the municipal corporation: all wards, one ward in depth, and the ward officers who
 * are created, moved and switched off here. A ward officer may read the activity of their own ward.
 */
@RestController
@RequestMapping("/api/v1/municipal")
@MunicipalOnly
public class CityController {

    public record NewOfficer(@NotBlank @Size(max = 100) String name,
                             @NotBlank @Pattern(regexp = "\\d{10}", message = "must be a 10 digit number") String phone,
                             @NotBlank @Size(min = 6, max = 72) String password, @NotNull Long wardId) {
    }

    /** Either field may be null: a null one is left as it is. */
    public record OfficerUpdate(Long wardId, Boolean active) {
    }

    private final MunicipalCityService city;
    private final OfficerDirectory officers;
    private final ActivityLog activity;
    private final MunicipalScope scope;
    private final WardDirectory wards;

    public CityController(MunicipalCityService city, OfficerDirectory officers, ActivityLog activity,
                          MunicipalScope scope, WardDirectory wards) {
        this.city = city;
        this.officers = officers;
        this.activity = activity;
        this.scope = scope;
        this.wards = wards;
    }

    @GetMapping("/wards")
    public CityView wards(@CurrentUserId Long id) {
        return city.city(id);
    }

    @GetMapping("/wards/{wardId}")
    public WardDetail ward(@CurrentUserId Long id, @PathVariable long wardId) {
        return city.ward(id, wardId);
    }

    /** A ward officer sees their own ward; the commissioner sees one ward (wardId) or the whole city. */
    @GetMapping("/activity")
    public List<ActivityLog.Entry> activity(@CurrentUserId Long id, @RequestParam(required = false) Long wardId) {
        Long own = scope.wardOf(id);
        if (own != null) {
            return activity.recent(own);
        }
        return activity.recent(wardId);
    }

    @GetMapping("/officers")
    public List<OfficerRow> officers(@CurrentUserId Long id) {
        scope.requireCommissioner(id);
        return city.officerRows();
    }

    @PostMapping("/officers")
    public List<OfficerRow> create(@CurrentUserId Long id, @Valid @RequestBody NewOfficer body) {
        scope.requireCommissioner(id);
        Officer o = officers.create(body.name(), body.phone(), body.password(), body.wardId());
        activity.record(id, o.wardId(), "OFFICER_CREATED", o.name());
        return city.officerRows();
    }

    @PutMapping("/officers/{officerId}")
    public List<OfficerRow> update(@CurrentUserId Long id, @PathVariable long officerId, @RequestBody OfficerUpdate body) {
        scope.requireCommissioner(id);
        if (body.wardId() != null) {
            Officer before = officerById(officerId);
            if (!body.wardId().equals(before.wardId())) {
                Officer moved = officers.moveTo(officerId, body.wardId());
                activity.record(id, moved.wardId(), "OFFICER_MOVED", moved.name() + " ← " + label(before.wardId()));
            }
        }
        if (body.active() != null) {
            Officer before = officerById(officerId);
            if (before.active() != body.active()) {
                Officer changed = officers.setActive(officerId, body.active());
                activity.record(id, changed.wardId(), changed.active() ? "OFFICER_ENABLED" : "OFFICER_DISABLED", changed.name());
            }
        }
        return city.officerRows();
    }

    private Officer officerById(long officerId) {
        return officers.all().stream().filter(o -> o.id().equals(officerId)).findFirst()
                .orElseThrow(() -> com.avshesh.common.ApiException.notFound("OFFICER_NOT_FOUND", "Officer not found"));
    }

    private String label(Long wardId) {
        return wardId == null ? "?" : wards.find(wardId).map(WardInfo::label).orElse("?");
    }
}
