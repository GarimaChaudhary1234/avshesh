package com.avshesh.user;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.avshesh.common.ApiException;
import com.avshesh.common.Hashing;
import com.avshesh.common.RateLimiter;
import com.avshesh.security.AuthCookies;
import com.avshesh.security.TokenService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    public record RegisterRequest(
            @NotBlank @Pattern(regexp = "\\d{10}", message = "must be a 10 digit number") String phone,
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Size(min = 6, max = 72) String password,
            @NotNull Role role,
            @DecimalMin("-90") @DecimalMax("90") Double lat,
            @DecimalMin("-180") @DecimalMax("180") Double lng,
            @Size(max = 5) String language) {
    }

    public record LoginRequest(@NotBlank @Size(max = 20) String phone, @NotBlank @Size(max = 72) String password) {
    }

    public record AuthResponse(String token, UserAccount user) {
    }

    private final AccountService accounts;
    private final TokenService tokens;
    private final RateLimiter failuresPerPhone;
    private final RateLimiter failuresPerClient;
    private final RateLimiter registrationsPerClient;
    private final AuthCookies cookies;
    private final boolean phoneProofRequired;

    public AuthController(AccountService accounts, TokenService tokens,
                          @Qualifier("loginLimiter") RateLimiter failuresPerPhone,
                          @Qualifier("loginClientLimiter") RateLimiter failuresPerClient,
                          @Qualifier("registerLimiter") RateLimiter registrationsPerClient, AuthCookies cookies,
                          @org.springframework.beans.factory.annotation.Value("${avshesh.phone-verification.required:false}") boolean phoneProofRequired) {
        this.phoneProofRequired = phoneProofRequired;
        this.accounts = accounts;
        this.tokens = tokens;
        this.failuresPerPhone = failuresPerPhone;
        this.failuresPerClient = failuresPerClient;
        this.registrationsPerClient = registrationsPerClient;
        this.cookies = cookies;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest req, HttpServletRequest http,
                                 HttpServletResponse response) {
        if (req.role() == Role.MUNICIPAL || req.role() == Role.FIELD_STAFF) {
            // Officers are created by the commissioner and collection workers by their ward officer, never by self-registration.
            throw ApiException.forbidden("AUTH_MUNICIPAL_SELF_REGISTER", "Municipal accounts cannot be self-registered");
        }
        if ((req.lat() == null) != (req.lng() == null)) {
            throw ApiException.badRequest("AUTH_LOCATION_PAIR", "Send both latitude and longitude, or neither");
        }
        if (!registrationsPerClient.tryAcquire(http.getRemoteAddr())) {
            throw ApiException.tooManyRequests("AUTH_TOO_MANY_ACCOUNTS", "Too many new accounts from this network. Please try again later.");
        }
        UserAccount created = accounts.register(req.phone(), req.name(), req.password(), req.role(), req.lat(), req.lng(),
                req.language(), Hashing.sha256(http.getRemoteAddr()));
        // Without an SMS service there is no way to prove a number, so by default a new account can use the app at once.
        return respond(phoneProofRequired ? created : accounts.markPhoneVerified(created.id()), response);
    }

    /**
     * Wrong passwords are counted per client and phone, and per client overall, so a guesser is slowed down
     * without letting a stranger lock a real user out from somewhere else.
     */
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req, HttpServletRequest http,
                              HttpServletResponse response) {
        String client = http.getRemoteAddr();
        String key = client + ":" + req.phone();
        if (failuresPerPhone.isBlocked(key) || failuresPerClient.isBlocked(client)) {
            throw ApiException.tooManyRequests("AUTH_TOO_MANY_ATTEMPTS", "Too many failed attempts. Please wait a few minutes and try again.");
        }
        try {
            UserAccount account = accounts.authenticate(req.phone(), req.password());
            failuresPerPhone.clear(key);
            return respond(account, response);
        } catch (ApiException e) {
            failuresPerPhone.record(key);
            failuresPerClient.record(client);
            throw e;
        }
    }

    /** Ends the browser session by clearing the login cookie. */
    @PostMapping("/logout")
    public void logout(HttpServletResponse response) {
        cookies.clear(response);
    }

    /** The token is set as an HttpOnly cookie for the browser and also returned for API clients. */
    private AuthResponse respond(UserAccount account, HttpServletResponse response) {
        String token = tokens.issue(account);
        cookies.write(response, token);
        return new AuthResponse(token, account);
    }
}
