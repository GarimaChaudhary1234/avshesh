package com.avshesh.user;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.ApiException;

@Service
public class CollectorSettingsService implements CollectorSettingsUpdater, CollectorProfileUpdater, CollectorVerifier {

    private final CollectorRepository collectors;

    public CollectorSettingsService(CollectorRepository collectors) {
        this.collectors = collectors;
    }

    @Override
    @Transactional
    public void update(long collectorId, double serviceRadiusKm, double minTripProfit, double minLoadKg,
                       Double dailyCapacityKg) {
        if (serviceRadiusKm <= 0 || minTripProfit < 0 || minLoadKg < 0) {
            throw ApiException.badRequest("COLLECTOR_SETTINGS_INVALID", "Service radius, minimum profit and minimum load must be valid numbers");
        }
        Collector c = find(collectorId);
        c.setServiceRadiusKm(serviceRadiusKm);
        c.setMinTripProfit(minTripProfit);
        c.setMinLoadKg(minLoadKg);
        c.setDailyCapacityKg(dailyCapacityKg);
        collectors.save(c);
    }

    @Override
    @Transactional
    public void update(long collectorId, CollectorBusinessProfile profile) {
        Collector c = find(collectorId);
        c.setBusinessName(blankToNull(profile.businessName()));
        c.setAddress(blankToNull(profile.address()));
        c.setVehicleType(profile.vehicleType());
        c.setCostPerKm(profile.costPerKm());
        c.setWorkingHours(blankToNull(profile.workingHours()));
        c.setAcceptingPickups(profile.acceptingPickups());
        c.setVehicleCapacityKg(profile.vehicleCapacityKg());
        collectors.save(c);
    }

    @Override
    @Transactional
    public void setStatus(long collectorId, VerificationStatus status) {
        Collector c = find(collectorId);
        c.setVerificationStatus(status);
        collectors.save(c);
    }

    private Collector find(long collectorId) {
        return collectors.findById(collectorId)
                .orElseThrow(() -> ApiException.notFound("Collector setup not found"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
