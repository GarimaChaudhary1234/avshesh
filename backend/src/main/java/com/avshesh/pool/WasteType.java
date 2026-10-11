package com.avshesh.pool;

import com.avshesh.scan.Category;
import com.avshesh.user.Role;

/** What a pool collects, and which kind of collector serves it. */
public enum WasteType {
    DRY(Role.KABADIWALA),
    WET(Role.COMPOST);

    private final Role collectorRole;

    WasteType(Role collectorRole) {
        this.collectorRole = collectorRole;
    }

    public Role collectorRole() {
        return collectorRole;
    }

    public static WasteType of(Category category) {
        return category == Category.WET ? WET : DRY;
    }

    public static WasteType servedBy(Role role) {
        return role == Role.COMPOST ? WET : DRY;
    }
}
