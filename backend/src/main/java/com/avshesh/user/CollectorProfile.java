package com.avshesh.user;

/** A scrap dealer or compost center: trip rules, business profile and verification. */
public record CollectorProfile(UserAccount user, double serviceRadiusKm, double minTripProfit, double minLoadKg,
                               Double dailyCapacityKg, String businessName, String address, VehicleType vehicleType,
                               double costPerKm, String workingHours, boolean acceptingPickups,
                               VerificationStatus verification, double vehicleCapacityKg) {

    /** The name households see: the business name if set, otherwise the person's name. */
    public String displayName() {
        return businessName != null && !businessName.isBlank() ? businessName : user.name();
    }

    /** Only approved collectors with a proven phone number who are accepting pickups take part in pools. */
    public boolean canWork() {
        return verification == VerificationStatus.VERIFIED && acceptingPickups && user.phoneVerified();
    }
}
