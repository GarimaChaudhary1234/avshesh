package com.avshesh.user;

public enum VehicleType {
    CYCLE_RICKSHAW(150),
    E_RICKSHAW(400),
    AUTO(500),
    MINI_TRUCK(1500);

    private final double defaultCapacityKg;

    VehicleType(double defaultCapacityKg) {
        this.defaultCapacityKg = defaultCapacityKg;
    }

    /** What one trip of this kind of vehicle can usually carry. */
    public double defaultCapacityKg() {
        return defaultCapacityKg;
    }
}
