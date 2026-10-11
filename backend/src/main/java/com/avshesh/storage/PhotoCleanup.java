package com.avshesh.storage;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Deletes scan photos that never became a listing, so abandoned scans do not fill the disk. */
@Component
public class PhotoCleanup {

    private static final Logger log = LoggerFactory.getLogger(PhotoCleanup.class);

    private final PhotoStorage storage;
    private final Duration ttl;

    public PhotoCleanup(PhotoStorage storage, @Value("${avshesh.photos.temp-ttl-hours:24}") long ttlHours) {
        this.storage = storage;
        this.ttl = Duration.ofHours(ttlHours);
    }

    @Scheduled(fixedDelayString = "PT1H", initialDelayString = "PT5M")
    public void deleteAbandonedScans() {
        int deleted = storage.deleteTempOlderThan(ttl);
        if (deleted > 0) {
            log.info("Deleted {} scan photos older than {} hours that were never used in a listing", deleted, ttl.toHours());
        }
    }
}
