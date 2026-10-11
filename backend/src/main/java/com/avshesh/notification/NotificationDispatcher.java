package com.avshesh.notification;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.sms.SmsSender;
import com.avshesh.user.UserAccount;
import com.avshesh.user.UserDirectory;

/**
 * The one {@link Notifier}: writes the message, translated into the user's language, to their inbox and sends an
 * SMS for the events listed in {@code avshesh.sms.events}. A failing SMS never stops the action that caused it.
 */
@Service
public class NotificationDispatcher implements Notifier {

    private static final Logger log = LoggerFactory.getLogger(NotificationDispatcher.class);

    private final NotificationRepository inbox;
    private final UserDirectory users;
    private final MessageSource messages;
    private final SmsSender sms;
    private final Set<String> smsEvents;

    public NotificationDispatcher(NotificationRepository inbox, UserDirectory users, MessageSource messages, SmsSender sms,
                                  @Value("${avshesh.sms.events:pickup.confirmed,municipal.scheduled}") List<String> smsEvents) {
        this.inbox = inbox;
        this.users = users;
        this.messages = messages;
        this.sms = sms;
        this.smsEvents = smsEvents.stream().map(String::strip).collect(Collectors.toSet());
    }

    @Override
    @Transactional
    public void notify(Long userId, String code, Object... args) {
        UserAccount user = users.get(userId);
        String text = messages.getMessage("notify." + code, args, "notify." + code, Locale.forLanguageTag(user.language()));

        Notification n = new Notification();
        n.setUserId(userId);
        n.setCode(code);
        n.setMessage(text);
        inbox.save(n);
        log.info("NOTIFY user={} {}: {}", userId, code, text);

        if (smsEvents.contains(code)) {
            try {
                sms.send(user.phone(), text);
            } catch (RuntimeException e) {
                log.warn("SMS for '{}' to user {} failed: {}", code, userId, e.getMessage());
            }
        }
    }
}
