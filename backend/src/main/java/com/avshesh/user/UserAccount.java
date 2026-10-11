package com.avshesh.user;

/** What other modules may know about a user. The {@link User} entity stays inside this module. */
public record UserAccount(Long id, Role role, String name, String phone, double lat, double lng, String geohash,
                          Long wardId, boolean phoneVerified, String language) {

    static UserAccount from(User u) {
        return new UserAccount(u.getId(), u.getRole(), u.getName(), u.getPhone(), u.getLat(), u.getLng(),
                u.getGeohash(), u.getWardId(), u.isPhoneVerified(), u.getLanguage());
    }
}
