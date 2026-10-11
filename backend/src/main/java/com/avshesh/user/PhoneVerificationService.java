package com.avshesh.user;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.common.RateLimiter;
import com.avshesh.sms.SmsSender;

/**
 * Proves that a person controls a phone number by sending a 6 digit code. Used to verify a new account and to
 * reset a forgotten password. Codes live for 10 minutes, only the hash is stored, and guessing is limited.
 */
@Service
public class PhoneVerificationService {

    public enum Purpose { VERIFY, RESET }

    /** @param devCode the code itself, only when avshesh.sms.dev-codes=true (local development, never in production) */
    public record Sent(boolean sent, String devCode) {
    }

    private static final Duration LIFETIME = Duration.ofMinutes(10);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final PhoneCodeRepository codes;
    private final PasswordEncoder encoder;
    private final SmsSender sms;
    private final MessageSource messages;
    private final RateLimiter perPhone;
    private final RateLimiter perClient;
    private final RateLimiter guesses;
    private final boolean devCodes;

    PhoneVerificationService(PhoneCodeRepository codes, PasswordEncoder encoder, SmsSender sms, MessageSource messages,
                             @Qualifier("smsPhoneLimiter") RateLimiter perPhone,
                             @Qualifier("smsClientLimiter") RateLimiter perClient,
                             @Qualifier("smsGuessLimiter") RateLimiter guesses,
                             @Value("${avshesh.sms.dev-codes:false}") boolean devCodes) {
        this.codes = codes;
        this.encoder = encoder;
        this.sms = sms;
        this.messages = messages;
        this.perPhone = perPhone;
        this.perClient = perClient;
        this.guesses = guesses;
        this.devCodes = devCodes;
    }

    @Transactional
    public Sent request(String phone, Purpose purpose, String clientIp, String language) {
        if (!perClient.tryAcquire(clientIp) || !perPhone.tryAcquire(phone)) {
            throw ApiException.tooManyRequests("SMS_TOO_MANY", "Too many codes were requested. Please try again in a while.");
        }
        // Only the newest code is valid.
        codes.findByPhoneAndPurposeAndConsumedFalse(phone, purpose).forEach(c -> c.setConsumed(true));

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        PhoneCode row = new PhoneCode();
        row.setPhone(phone);
        row.setPurpose(purpose);
        row.setCodeHash(encoder.encode(code));
        row.setExpiresAt(LocalDateTime.now().plus(LIFETIME));
        codes.save(row);

        String key = purpose == Purpose.VERIFY ? "sms.code.verify" : "sms.code.reset";
        sms.send(phone, messages.getMessage(key, new Object[] {code}, key, Locale.forLanguageTag(language)));
        return new Sent(true, devCodes ? code : null);
    }

    /** Counts a request like a real one (same limits, same cost) without sending anything: used for unknown numbers. */
    public void countAttemptOnly(String clientIp, String phone) {
        if (!perClient.tryAcquire(clientIp) || !perPhone.tryAcquire(phone)) {
            throw ApiException.tooManyRequests("SMS_TOO_MANY", "Too many codes were requested. Please try again in a while.");
        }
        encoder.encode("000000");
    }

    /** Throws unless {@code code} is the newest unused, unexpired code for this phone and purpose. */
    @Transactional(noRollbackFor = ApiException.class)
    public void verify(String phone, Purpose purpose, String code) {
        String key = phone + ":" + purpose;
        if (guesses.isBlocked(key)) {
            throw ApiException.tooManyRequests("SMS_GUESSES", "Too many wrong codes. Please wait a few minutes and try again.");
        }
        PhoneCode row = codes.findFirstByPhoneAndPurposeAndConsumedFalseOrderByIdDesc(phone, purpose)
                .filter(c -> c.getExpiresAt().isAfter(LocalDateTime.now()))
                .orElseThrow(() -> ApiException.badRequest("SMS_CODE_EXPIRED", "This code has expired. Please ask for a new one."));
        if (code == null || !encoder.matches(code, row.getCodeHash())) {
            guesses.record(key);
            throw ApiException.badRequest("SMS_CODE_WRONG", "That code is not correct.");
        }
        row.setConsumed(true);
        guesses.clear(key);
    }
}
