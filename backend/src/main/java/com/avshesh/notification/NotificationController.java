package com.avshesh.notification;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.avshesh.security.CurrentUserId;

/** The logged-in user's own inbox. */
@RestController
@RequestMapping("/api/v1/me/notifications")
public class NotificationController {

    public record Item(Long id, String code, String message, LocalDateTime createdAt, boolean read) {
    }

    public record Inbox(long unread, List<Item> items) {
    }

    private final NotificationRepository inbox;

    public NotificationController(NotificationRepository inbox) {
        this.inbox = inbox;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public Inbox list(@CurrentUserId Long userId) {
        List<Item> items = inbox.findTop50ByUserIdOrderByIdDesc(userId).stream()
                .map(n -> new Item(n.getId(), n.getCode(), n.getMessage(), n.getCreatedAt(), n.getReadAt() != null))
                .toList();
        return new Inbox(inbox.countByUserIdAndReadAtIsNull(userId), items);
    }

    @PostMapping("/read")
    @Transactional
    public Inbox markAllRead(@CurrentUserId Long userId) {
        inbox.markAllRead(userId);
        return list(userId);
    }
}
