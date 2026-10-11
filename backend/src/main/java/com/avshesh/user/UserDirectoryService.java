package com.avshesh.user;

import java.util.Arrays;
import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;

@Service
@Transactional(readOnly = true)
public class UserDirectoryService implements UserDirectory, AccountSignals {

    private static final List<Role> COLLECTOR_ROLES = List.of(Role.KABADIWALA, Role.COMPOST);

    private final UserRepository users;
    private final CollectorRepository collectors;

    public UserDirectoryService(UserRepository users, CollectorRepository collectors) {
        this.users = users;
        this.collectors = collectors;
    }

    @Override
    public UserAccount get(long userId) {
        return users.findById(userId).map(UserAccount::from)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    @Override
    public UserAccount requireRole(long userId, Role... allowed) {
        UserAccount u = get(userId);
        for (Role r : allowed) {
            if (u.role() == r) {
                return u;
            }
        }
        throw ApiException.forbidden("ROLE_FORBIDDEN", "This action is not available for your role");
    }

    @Override
    public UserAccount requireVerifiedRole(long userId, Role... allowed) {
        UserAccount u = requireRole(userId, allowed);
        if (!u.phoneVerified()) {
            throw ApiException.forbidden("PHONE_NOT_VERIFIED", "Please verify your phone number first");
        }
        return u;
    }

    @Override
    public Map<Long, UserAccount> getAll(Collection<Long> userIds) {
        return users.findAllById(userIds).stream()
                .map(UserAccount::from)
                .collect(Collectors.toMap(UserAccount::id, Function.identity()));
    }

    @Override
    public List<CollectorProfile> collectorsByRole(Role role) {
        return users.findByRole(role).stream()
                .map(this::profileOf)
                .flatMap(Optional::stream)
                .filter(CollectorProfile::canWork)
                .toList();
    }

    @Override
    public List<CollectorProfile> allCollectors(Long wardId) {
        return COLLECTOR_ROLES.stream()
                .flatMap(role -> users.findByRole(role).stream())
                .filter(u -> wardId == null || wardId.equals(u.getWardId()))
                .map(this::profileOf)
                .flatMap(Optional::stream)
                .toList();
    }

    @Override
    public Optional<CollectorProfile> findCollector(long userId) {
        return users.findById(userId).flatMap(this::profileOf);
    }

    @Override
    public CollectorProfile requireCollector(long userId) {
        requireRole(userId, Role.KABADIWALA, Role.COMPOST);
        return findCollector(userId).orElseThrow(() -> ApiException.notFound("Collector setup not found"));
    }

    @Override
    public Map<Role, Long> countByRole(Long wardId) {
        Map<Role, Long> counts = new EnumMap<>(Role.class);
        Arrays.stream(Role.values()).forEach(r ->
                counts.put(r, wardId == null ? users.countByRole(r) : users.countByRoleAndWardId(r, wardId)));
        return counts;
    }

    @Override
    public Map<Long, Map<Role, Long>> countByRoleInEachWard() {
        Map<Long, Map<Role, Long>> result = new java.util.HashMap<>();
        for (Object[] row : users.countByWardAndRole()) {
            result.computeIfAbsent((Long) row[0], k -> new EnumMap<>(Role.class)).put((Role) row[1], (Long) row[2]);
        }
        return result;
    }

    @Override
    public boolean isActive(long userId) {
        return users.findById(userId).map(User::isActive).orElse(false);
    }

    @Override
    public Optional<String> registeredIpHash(long userId) {
        return users.findById(userId).map(User::getRegisteredIpHash);
    }

    private Optional<CollectorProfile> profileOf(User u) {
        return collectors.findById(u.getId()).map(c -> new CollectorProfile(UserAccount.from(u),
                c.getServiceRadiusKm(), c.getMinTripProfit(), c.getMinLoadKg(), c.getDailyCapacityKg(),
                c.getBusinessName(), c.getAddress(), c.getVehicleType(), c.getCostPerKm(), c.getWorkingHours(),
                c.isAcceptingPickups(), c.getVerificationStatus(),
                c.getVehicleCapacityKg() != null ? c.getVehicleCapacityKg() : c.getVehicleType().defaultCapacityKg()));
    }
}
