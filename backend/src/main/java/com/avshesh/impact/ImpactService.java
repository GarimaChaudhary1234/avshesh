package com.avshesh.impact;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.common.GeoUtil;
import com.avshesh.scan.Category;
import com.avshesh.ward.WardDirectory;
import com.avshesh.ward.WardInfo;

@Service
public class ImpactService implements ImpactRecorder, ImpactReader {

    private final ImpactEventRepository events;
    private final ImpactMetrics metrics;
    private final WardDirectory wards;
    private final WasteBaseline baseline;

    public ImpactService(ImpactEventRepository events, ImpactMetrics metrics, WardDirectory wards, WasteBaseline baseline) {
        this.events = events;
        this.metrics = metrics;
        this.wards = wards;
        this.baseline = baseline;
    }

    @Override
    @Transactional
    public void record(String areaGeohash, Long wardId, Category category, double kgDiverted,
                       double paidToHousehold, Long stopId, Long pickupId) {
        ImpactEvent e = new ImpactEvent();
        e.setAreaGeohash(areaGeohash);
        e.setWardId(wardId);
        e.setCategory(category.name());
        e.setKgDiverted(kgDiverted);
        e.setCo2SavedKg(metrics.co2SavedKg(category, kgDiverted));
        e.setCompostedKg(metrics.compostedKg(category, kgDiverted));
        e.setPaidToHousehold(paidToHousehold);
        e.setStopId(stopId);
        e.setPickupId(pickupId);
        events.save(e);
    }

    @Override
    @Transactional(readOnly = true)
    public ImpactView summary(String area) {
        if (area == null || area.isBlank()) {
            // The whole city is measured against the people of the wards where pickups happened, not all of Bhubaneswar.
            double people = events.wardsWithEvents().stream().flatMap(id -> wards.find(id).stream())
                    .mapToDouble(w -> w.population() == null ? 0 : w.population()).sum();
            return summarise("all", events.totalsAll(), people, events.firstEventAll());
        }
        String escaped = area.toLowerCase().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return summarise(area, events.totalsForArea(escaped + "%"), 0, null);
    }

    @Override
    @Transactional(readOnly = true)
    public ImpactView summaryForWard(Long wardId) {
        if (wardId == null) {
            return summary(null);
        }
        double people = wards.find(wardId).map(WardInfo::population).map(Integer::doubleValue).orElse(0.0);
        return summarise("ward-" + wardId, events.totalsForWard(wardId), people, events.firstEventForWard(wardId));
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.Map<Long, ImpactView> summariesByWard() {
        java.util.Map<Long, ImpactView> result = new java.util.HashMap<>();
        events.wardsWithEvents().forEach(id -> result.put(id, summaryForWard(id)));
        return result;
    }

    private ImpactView summarise(String label, ImpactTotals t, double people, LocalDateTime firstEvent) {
        double estimated = 0;
        Double percent = null;
        if (people > 0) {
            long days = firstEvent == null ? 1 : ChronoUnit.DAYS.between(firstEvent.toLocalDate(), LocalDate.now()) + 1;
            estimated = GeoUtil.round2(baseline.estimatedKg(people, days));
            percent = WasteBaseline.percent(t.kgDiverted(), estimated);
        }
        return new ImpactView(label, GeoUtil.round2(t.kgDiverted()), GeoUtil.round2(t.kgRecycled()),
                GeoUtil.round2(t.kgComposted()), GeoUtil.round2(t.co2SavedKg()),
                GeoUtil.round2(t.paidToHouseholds()), t.trips().intValue(), t.events().intValue(), estimated, percent);
    }
}
