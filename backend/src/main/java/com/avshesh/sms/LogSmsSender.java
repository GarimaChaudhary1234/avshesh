package com.avshesh.sms;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Default: writes the message to the log instead of sending it. The number is masked. */
@Component
@ConditionalOnProperty(name = "avshesh.sms.sender", havingValue = "log", matchIfMissing = true)
public class LogSmsSender implements SmsSender {

    private static final Logger log = LoggerFactory.getLogger(LogSmsSender.class);

    @Override
    public void send(String phone, String text) {
        String masked = phone.length() > 4 ? "******" + phone.substring(phone.length() - 4) : "****";
        log.info("SMS (not sent, log only) to {}: {}", masked, text);
    }
}
