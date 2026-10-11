package com.avshesh.ward;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Loads the real ward boundaries of one city into an empty database. To use another city, point
 * avshesh.wards.file at a file in the same format and set avshesh.wards.city.
 */
@Component
@Order(0)
public class WardImporter implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(WardImporter.class);

    private final WardRepository wards;
    private final WardService wardService;
    private final Resource file;
    private final String city;

    public WardImporter(WardRepository wards, WardService wardService,
                        @Value("${avshesh.wards.file}") Resource file, @Value("${avshesh.wards.city}") String city) {
        this.wards = wards;
        this.wardService = wardService;
        this.file = file;
        this.city = city;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (wards.count() > 0) {
            return;
        }
        List<Ward> parsed = new ArrayList<>();
        try (BufferedReader in = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = in.readLine()) != null) {
                if (!line.isBlank() && !line.startsWith("#")) {
                    parsed.add(parse(line));
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read ward file " + file, e);
        }
        wards.saveAll(parsed);
        wardService.reload();
        log.info("Imported {} wards of {}", parsed.size(), city);
    }

    private Ward parse(String line) {
        String[] cols = line.split("\t");
        Ward w = new Ward();
        w.setCity(city);
        w.setWardNo(cols[0]);
        w.setZone(cols[1].isBlank() ? null : cols[1]);
        w.setHouseholds(cols[2].isBlank() ? null : Integer.valueOf(cols[2]));
        w.setPopulation(cols[3].isBlank() ? null : Integer.valueOf(cols[3]));
        w.setBoundary(cols[4]);

        double minLat = Double.MAX_VALUE;
        double maxLat = -Double.MAX_VALUE;
        double minLng = Double.MAX_VALUE;
        double maxLng = -Double.MAX_VALUE;
        for (double[] p : WardGeometry.parseRing(cols[4].split("\\|")[0])) {
            minLng = Math.min(minLng, p[0]);
            maxLng = Math.max(maxLng, p[0]);
            minLat = Math.min(minLat, p[1]);
            maxLat = Math.max(maxLat, p[1]);
        }
        w.setMinLat(minLat);
        w.setMaxLat(maxLat);
        w.setMinLng(minLng);
        w.setMaxLng(maxLng);
        return w;
    }
}
