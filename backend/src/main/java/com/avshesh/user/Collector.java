package com.avshesh.user;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Extra settings for KABADIWALA and COMPOST users. Shares its id with the users table. */
@Entity
@Table(name = "collectors")
@Getter
@Setter
@NoArgsConstructor
public class Collector {

    @Id
    private Long userId;

    // Trip rules
    private double serviceRadiusKm = 5;
    private double minTripProfit = 200;
    private double minLoadKg = 0;
    private Double dailyCapacityKg;

    // Business profile
    private String businessName;
    private String address;

    @Enumerated(EnumType.STRING)
    private VehicleType vehicleType = VehicleType.CYCLE_RICKSHAW;

    private double costPerKm = 8;

    /** Null means the usual capacity of the vehicle type. */
    private Double vehicleCapacityKg;
    private String workingHours;
    private boolean acceptingPickups = true;

    /** New collectors start PENDING and cannot take pools until the municipal corporation verifies them. */
    @Enumerated(EnumType.STRING)
    private VerificationStatus verificationStatus = VerificationStatus.PENDING;

    public Collector(Long userId) {
        this.userId = userId;
    }
}
