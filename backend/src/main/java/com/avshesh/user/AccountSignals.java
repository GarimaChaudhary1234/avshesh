package com.avshesh.user;

import java.util.Optional;

/** Facts about how an account was created that help spot fake ratings. Kept apart from {@link UserDirectory} so ordinary callers never see them. */
public interface AccountSignals {

    /** SHA-256 of the network address the account registered from, if it was recorded. */
    Optional<String> registeredIpHash(long userId);
}
