package com.avshesh.user;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** The part of a collector's profile that they edit themselves (verification is set by the municipality). */
public record CollectorBusinessProfile(
        @Size(max = 120) String businessName,
        @Size(max = 255) String address,
        @NotNull VehicleType vehicleType,
        @DecimalMin("0") @DecimalMax("100") double costPerKm,
        @Size(max = 60) String workingHours,
        boolean acceptingPickups,
        @DecimalMin("10") @DecimalMax("20000") Double vehicleCapacityKg) {
}
