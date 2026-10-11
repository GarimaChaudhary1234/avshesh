package com.avshesh.ward;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WardService implements WardLocator, WardDirectory {

    private final WardRepository wards;

    /** Parsed boundaries, built on first use (after the importer has filled the table). */
    private volatile List<WardGeometry> geometries;

    public WardService(WardRepository wards) {
        this.wards = wards;
    }

    @Override
    public Optional<Long> wardIdAt(double lat, double lng) {
        return geometries().stream().filter(g -> g.contains(lat, lng)).map(WardGeometry::wardId).findFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<WardInfo> find(long wardId) {
        return wards.findById(wardId).map(WardInfo::from);
    }

    @Override
    @Transactional(readOnly = true)
    public List<WardInfo> all() {
        return wards.findAll().stream()
                .sorted(Comparator.comparingInt(w -> numberOf(w.getWardNo())))
                .map(WardInfo::from).toList();
    }

    /** Called by the importer after it changes the ward table. */
    void reload() {
        geometries = null;
    }

    private List<WardGeometry> geometries() {
        List<WardGeometry> local = geometries;
        if (local == null) {
            synchronized (this) {
                if (geometries == null) {
                    geometries = loadGeometries();
                }
                local = geometries;
            }
        }
        return local;
    }

    private List<WardGeometry> loadGeometries() {
        return wards.findAll().stream().map(WardGeometry::of).toList();
    }

    private static int numberOf(String wardNo) {
        try {
            return Integer.parseInt(wardNo.replaceFirst("^[A-Za-z]+", ""));
        } catch (NumberFormatException e) {
            return Integer.MAX_VALUE;
        }
    }
}
