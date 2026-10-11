package com.avshesh.municipal;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.avshesh.municipal.MunicipalRequestService.TaskList;
import com.avshesh.security.CurrentUserId;
import com.avshesh.security.FieldStaffOnly;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** What a municipal collection worker can do: see the pickups assigned to them and report each one done or not done. */
@RestController
@RequestMapping("/api/v1/staff")
@FieldStaffOnly
public class FieldStaffController {

    public record Problem(@NotBlank @Size(max = 150) String reason) {
    }

    private final MunicipalRequestService requests;

    public FieldStaffController(MunicipalRequestService requests) {
        this.requests = requests;
    }

    @GetMapping("/tasks")
    public TaskList tasks(@CurrentUserId Long userId) {
        return requests.tasksOf(userId);
    }

    @PostMapping("/tasks/{requestId}/collected")
    public TaskList collected(@CurrentUserId Long userId, @PathVariable long requestId) {
        requests.markCollectedByStaff(userId, requestId);
        return requests.tasksOf(userId);
    }

    /** The worker could not collect it (nobody home, blocked road): it goes back to the officer to be scheduled again. */
    @PostMapping("/tasks/{requestId}/problem")
    public TaskList problem(@CurrentUserId Long userId, @PathVariable long requestId, @Valid @RequestBody Problem body) {
        requests.reportProblemByStaff(userId, requestId, body.reason());
        return requests.tasksOf(userId);
    }
}
