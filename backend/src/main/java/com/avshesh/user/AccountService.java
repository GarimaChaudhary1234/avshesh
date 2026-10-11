package com.avshesh.user;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;
import com.avshesh.common.GeoUtil;
import com.avshesh.common.RateLimiter;
import com.avshesh.ward.WardLocator;

/** Registration, password check and the few account fields a user can change. Token issuing is in the security module. */
@Service
public class AccountService {

    /** Demo default location (centre of ward 15, Bhubaneswar) when the client sends no coordinates. */
    public static final double DEFAULT_LAT = 20.305481;
    public static final double DEFAULT_LNG = 85.797729;

    // Rough bounding box of India: a pin far outside it is a mistake or a test, not a home.
    private static final double MIN_LAT = 6.0;
    private static final double MAX_LAT = 37.5;
    private static final double MIN_LNG = 68.0;
    private static final double MAX_LNG = 98.0;

    /** Languages the app is translated into. Anything else is stored as English. */
    public static final Set<String> LANGUAGES = Set.of("en", "hi", "or");

    private final UserRepository users;
    private final CollectorRepository collectors;
    private final PasswordEncoder passwordEncoder;
    private final WardLocator wards;
    private final List<LocationLock> locks;
    private final RateLimiter moves;

    public AccountService(UserRepository users, CollectorRepository collectors, PasswordEncoder passwordEncoder,
                          WardLocator wards, List<LocationLock> locks, @Qualifier("locationLimiter") RateLimiter moves) {
        this.locks = locks;
        this.moves = moves;
        this.users = users;
        this.collectors = collectors;
        this.passwordEncoder = passwordEncoder;
        this.wards = wards;
    }

    /**
     * Self-service registration for households, scrap dealers and compost centers. The ward comes from the
     * location. The phone number starts unverified.
     *
     * @param ipHash hash of the address the request came from, or null
     */
    @Transactional
    public UserAccount register(String phone, String name, String password, Role role, Double lat, Double lng,
                                String language, String ipHash) {
        User u = newUser(phone, name, password, role, lat != null ? lat : DEFAULT_LAT, lng != null ? lng : DEFAULT_LNG);
        u.setWardId(wards.wardIdAt(u.getLat(), u.getLng()).orElse(null));
        u.setLanguage(normalise(language));
        u.setRegisteredIpHash(ipHash);
        return save(u);
    }

    /**
     * Creates a municipal officer. Only the platform operator does this, never a visitor.
     *
     * @param wardId the ward this officer manages, or null for a city-wide commissioner
     */
    @Transactional
    public UserAccount registerOfficer(String phone, String name, String password, Long wardId) {
        User u = newUser(phone, name, password, Role.MUNICIPAL, DEFAULT_LAT, DEFAULT_LNG);
        u.setWardId(wardId);
        u.setPhoneVerified(true);
        return save(u);
    }

    /** A municipal collection worker of one ward. Created by the ward officer, never by a visitor. */
    @Transactional
    public UserAccount registerStaff(String phone, String name, String password, Long wardId) {
        User u = newUser(phone, name, password, Role.FIELD_STAFF, DEFAULT_LAT, DEFAULT_LNG);
        u.setWardId(wardId);
        u.setPhoneVerified(true);
        return save(u);
    }

    private User newUser(String phone, String name, String password, Role role, double lat, double lng) {
        if (users.findByPhone(phone).isPresent()) {
            throw ApiException.conflict("AUTH_PHONE_TAKEN", "This phone number is already registered");
        }
        User u = new User();
        u.setPhone(phone);
        u.setName(name);
        u.setRole(role);
        u.setPasswordHash(passwordEncoder.encode(password));
        u.setLat(lat);
        u.setLng(lng);
        u.setGeohash(GeoUtil.geohash(lat, lng));
        return u;
    }

    private UserAccount save(User u) {
        u = users.save(u);
        if (u.getRole() == Role.KABADIWALA || u.getRole() == Role.COMPOST) {
            collectors.save(new Collector(u.getId()));
        }
        return UserAccount.from(u);
    }

    /** Same message for unknown phone and wrong password so numbers cannot be probed. */
    @Transactional(readOnly = true)
    public UserAccount authenticate(String phone, String password) {
        User u = users.findByPhone(phone).orElse(null);
        if (u == null || u.getPasswordHash() == null || !passwordEncoder.matches(password, u.getPasswordHash())) {
            throw ApiException.unauthorized("AUTH_INVALID_CREDENTIALS", "Incorrect phone number or password");
        }
        if (!u.isActive()) {
            // Said only after the password was right, so it cannot be used to find out which numbers have accounts.
            throw ApiException.unauthorized("AUTH_ACCOUNT_DISABLED", "This account has been switched off. Please contact the municipal corporation.");
        }
        return UserAccount.from(u);
    }

    @Transactional(readOnly = true)
    public Optional<UserAccount> findByPhone(String phone) {
        return users.findByPhone(phone).map(UserAccount::from);
    }

    @Transactional
    public UserAccount markPhoneVerified(long userId) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound("User not found"));
        u.setPhoneVerified(true);
        return UserAccount.from(users.save(u));
    }

    @Transactional
    public UserAccount setLanguage(long userId, String language) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound("User not found"));
        u.setLanguage(normalise(language));
        return UserAccount.from(users.save(u));
    }

    /**
     * Moves a household, scrap dealer or compost center to a new home location and re-derives its ward. Refused
     * while work depends on the old location (an open listing, a scheduled pickup, an open municipal request),
     * and limited to a few moves per day.
     */
    @Transactional
    public UserAccount moveTo(long userId, double lat, double lng) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound("User not found"));
        if (u.getRole() == Role.MUNICIPAL || u.getRole() == Role.FIELD_STAFF) {
            throw ApiException.forbidden("LOCATION_NOT_ALLOWED", "The location of a municipal account is fixed by its ward");
        }
        if (lat < MIN_LAT || lat > MAX_LAT || lng < MIN_LNG || lng > MAX_LNG) {
            throw ApiException.badRequest("LOCATION_INVALID", "That location is outside India");
        }
        if (locks.stream().anyMatch(l -> l.holdsLocation(userId))) {
            throw ApiException.conflict("LOCATION_LOCKED",
                    "You cannot change your location while a listing, pickup or request is still open. Finish it first.");
        }
        if (!moves.tryAcquire(String.valueOf(userId))) {
            throw ApiException.tooManyRequests("LOCATION_TOO_OFTEN", "You changed your location too often. Try again tomorrow.");
        }
        u.setLat(lat);
        u.setLng(lng);
        u.setGeohash(GeoUtil.geohash(lat, lng));
        u.setWardId(wards.wardIdAt(lat, lng).orElse(null));
        return UserAccount.from(users.save(u));
    }

    /** Sets a new password after the phone number was proven with a reset code. */
    @Transactional
    public void resetPassword(String phone, String newPassword) {
        User u = users.findByPhone(phone).orElseThrow(() -> ApiException.notFound("User not found"));
        u.setPasswordHash(passwordEncoder.encode(newPassword));
        u.setPhoneVerified(true);
        users.save(u);
    }

    @Transactional(readOnly = true)
    public boolean hasAnyUser() {
        return users.count() > 0;
    }

    private static String normalise(String language) {
        return language != null && LANGUAGES.contains(language) ? language : "en";
    }
}
