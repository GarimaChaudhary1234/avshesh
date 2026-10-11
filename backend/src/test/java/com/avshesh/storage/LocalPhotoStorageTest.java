package com.avshesh.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalPhotoStorageTest {

    @TempDir
    Path dir;

    private LocalPhotoStorage storage() {
        return new LocalPhotoStorage(dir.toString());
    }

    @Test
    void photoUsedByAListingMovesToKeptAndSurvivesCleanup() throws Exception {
        LocalPhotoStorage s = storage();
        String key = s.saveTemp(new byte[] {1, 2, 3}, "image/png");
        assertTrue(Files.exists(dir.resolve("tmp").resolve(key)));

        assertTrue(s.keep(key));
        assertFalse(Files.exists(dir.resolve("tmp").resolve(key)));
        assertTrue(Files.exists(dir.resolve("kept").resolve(key)));

        // Even a very aggressive cleanup must not touch kept photos.
        assertEquals(0, s.deleteTempOlderThan(Duration.ZERO));
        assertTrue(Files.exists(dir.resolve("kept").resolve(key)));
    }

    @Test
    void keepingTwiceIsFine() {
        LocalPhotoStorage s = storage();
        String key = s.saveTemp(new byte[] {1}, "image/jpeg");
        assertTrue(s.keep(key));
        assertTrue(s.keep(key));
    }

    @Test
    void onlyOldAbandonedPhotosAreDeleted() throws Exception {
        LocalPhotoStorage s = storage();
        String old = s.saveTemp(new byte[] {1}, "image/jpeg");
        String recent = s.saveTemp(new byte[] {2}, "image/jpeg");
        Files.setLastModifiedTime(dir.resolve("tmp").resolve(old), FileTime.from(Instant.now().minus(Duration.ofHours(25))));

        assertEquals(1, s.deleteTempOlderThan(Duration.ofHours(24)));
        assertFalse(Files.exists(dir.resolve("tmp").resolve(old)));
        assertTrue(Files.exists(dir.resolve("tmp").resolve(recent)));
    }

    @Test
    void cleanupWithNothingStoredIsHarmless() {
        assertEquals(0, storage().deleteTempOlderThan(Duration.ofHours(24)));
    }

    @Test
    void unknownOrDangerousKeysAreRefused() {
        LocalPhotoStorage s = storage();
        assertFalse(s.keep(null));
        assertFalse(s.keep("../../etc/passwd"));
        assertFalse(s.keep("not-a-key.jpg"));
        assertFalse(s.keep("00000000-0000-0000-0000-000000000000.jpg"));
    }
}
