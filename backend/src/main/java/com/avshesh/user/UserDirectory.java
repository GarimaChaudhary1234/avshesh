package com.avshesh.user;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Read-only lookup of users, the only way other modules reach user data. */
public interface UserDirectory {

    UserAccount get(long userId);

    /** Same as {@link #get} but fails with 403 unless the user has one of the given roles. */
    UserAccount requireRole(long userId, Role... allowed);

    /** Like {@link #requireRole}, and also fails with 403 (code PHONE_NOT_VERIFIED) until the phone number is proven. */
    UserAccount requireVerifiedRole(long userId, Role... allowed);

    Map<Long, UserAccount> getAll(Collection<Long> userIds);

    /** Collectors of one role who can currently take part in pools (verified and accepting pickups). */
    List<CollectorProfile> collectorsByRole(Role role);

    /**
     * Every scrap dealer and compost center, whatever their status, for the municipal corporation.
     *
     * @param wardId only collectors located in this ward, or null for the whole city
     */
    List<CollectorProfile> allCollectors(Long wardId);

    Optional<CollectorProfile> findCollector(long userId);

    /** Fails with 403 unless the user is a kabadiwala or compost center. */
    CollectorProfile requireCollector(long userId);

    /** @param wardId only users located in this ward, or null for the whole city */
    Map<Role, Long> countByRole(Long wardId);

    /** Users of each role in every ward, keyed by ward id (wards without users are missing). */
    Map<Long, Map<Role, Long>> countByRoleInEachWard();

    /** False for an account a commissioner has switched off. */
    boolean isActive(long userId);
}
