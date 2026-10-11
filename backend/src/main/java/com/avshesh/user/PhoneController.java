package com.avshesh.user;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.avshesh.common.ApiException;
import com.avshesh.security.CurrentUserId;
import com.avshesh.user.PhoneVerificationService.Purpose;
import com.avshesh.user.PhoneVerificationService.Sent;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** The logged-in user's own account: phone proof, language, and the forgotten-password flow. */
@RestController
@RequestMapping("/api/v1")
public class PhoneController {

    public record CodeRequest(@NotBlank @Pattern(regexp = "\\d{6}", message = "must be 6 digits") String code) {
    }

    public record LanguageRequest(@NotBlank @Pattern(regexp = "en|hi|or", message = "must be en, hi or or") String language) {
    }

    public record ForgotRequest(@NotBlank @Pattern(regexp = "\\d{10}", message = "must be a 10 digit number") String phone) {
    }

    public record ResetRequest(@NotBlank @Pattern(regexp = "\\d{10}", message = "must be a 10 digit number") String phone,
                               @NotBlank @Pattern(regexp = "\\d{6}", message = "must be 6 digits") String code,
                               @NotBlank @Size(min = 6, max = 72) String newPassword) {
    }

    public record LocationRequest(@NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
                                  @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng) {
    }

    private final com.avshesh.ward.WardDirectory wardDirectory;
    private final AccountService accounts;
    private final UserDirectory users;
    private final PhoneVerificationService verification;

    public PhoneController(AccountService accounts, UserDirectory users, PhoneVerificationService verification,
                           com.avshesh.ward.WardDirectory wardDirectory) {
        this.wardDirectory = wardDirectory;
        this.accounts = accounts;
        this.users = users;
        this.verification = verification;
    }

    @GetMapping("/me")
    public UserAccount me(@CurrentUserId Long userId) {
        return users.get(userId);
    }

    /** The ward of the logged-in user, or null (a commissioner, or a home outside every ward). */
    @GetMapping("/me/ward")
    public com.avshesh.ward.WardInfo myWard(@CurrentUserId Long userId) {
        Long ward = users.get(userId).wardId();
        return ward == null ? null : wardDirectory.find(ward).orElse(null);
    }

    @PutMapping("/me/language")
    public UserAccount language(@CurrentUserId Long userId, @Valid @RequestBody LanguageRequest body) {
        return accounts.setLanguage(userId, body.language());
    }

    /** Moves the logged-in user's home location (and so their ward). */
    @PutMapping("/me/location")
    public UserAccount location(@CurrentUserId Long userId, @Valid @RequestBody LocationRequest body) {
        return accounts.moveTo(userId, body.lat(), body.lng());
    }

    /** Sends a verification code to the logged-in user's own phone number. */
    @PostMapping("/me/phone/send-code")
    public Sent sendCode(@CurrentUserId Long userId, HttpServletRequest http) {
        UserAccount me = users.get(userId);
        if (me.phoneVerified()) {
            return new Sent(false, null);
        }
        return verification.request(me.phone(), Purpose.VERIFY, http.getRemoteAddr(), me.language());
    }

    @PostMapping("/me/phone/verify")
    public UserAccount verify(@CurrentUserId Long userId, @Valid @RequestBody CodeRequest body) {
        UserAccount me = users.get(userId);
        if (!me.phoneVerified()) {
            verification.verify(me.phone(), Purpose.VERIFY, body.code());
            return accounts.markPhoneVerified(userId);
        }
        return me;
    }

    /** Always answers the same, so it cannot be used to find out which numbers have an account. */
    @PostMapping("/auth/password/forgot")
    public Sent forgot(@Valid @RequestBody ForgotRequest body, HttpServletRequest http) {
        return accounts.findByPhone(body.phone())
                .map(u -> verification.request(u.phone(), Purpose.RESET, http.getRemoteAddr(), u.language()))
                .orElseGet(() -> {
                    // Same cost and same limits as a real request, nothing is sent.
                    verification.countAttemptOnly(http.getRemoteAddr(), body.phone());
                    return new Sent(true, null);
                });
    }

    @PostMapping("/auth/password/reset")
    public Sent reset(@Valid @RequestBody ResetRequest body) {
        if (accounts.findByPhone(body.phone()).isEmpty()) {
            throw ApiException.badRequest("SMS_CODE_WRONG", "That code is not correct.");
        }
        verification.verify(body.phone(), Purpose.RESET, body.code());
        accounts.resetPassword(body.phone(), body.newPassword());
        return new Sent(true, null);
    }
}
