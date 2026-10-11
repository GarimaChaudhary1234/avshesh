package com.avshesh.notification;

/** Tells a user something happened: stored in their in-app inbox and, for important events, sent by SMS. */
public interface Notifier {

    /**
     * @param code message key under {@code notify.*} in the message bundles; the text is picked in the user's language
     * @param args values for the {0}, {1}... placeholders of the message
     */
    void notify(Long userId, String code, Object... args);
}
