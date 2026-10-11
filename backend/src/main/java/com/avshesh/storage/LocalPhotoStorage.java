package com.avshesh.storage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.stream.Stream;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("!aws")
public class LocalPhotoStorage implements PhotoStorage {

    private final Path temp;
    private final Path kept;

    public LocalPhotoStorage(@Value("${avshesh.photos.dir}") String dir) {
        this.temp = Path.of(dir, "tmp");
        this.kept = Path.of(dir, "kept");
    }

    @Override
    public String saveTemp(byte[] image, String contentType) {
        String key = UUID.randomUUID() + extensionOf(contentType);
        try {
            Files.createDirectories(temp);
            Files.write(temp.resolve(key), image);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return key;
    }

    @Override
    public boolean keep(String key) {
        if (key == null || !KEY.matcher(key).matches()) {
            return false;
        }
        Path from = temp.resolve(key);
        if (!Files.exists(from)) {
            return Files.exists(kept.resolve(key));
        }
        try {
            Files.createDirectories(kept);
            Files.move(from, kept.resolve(key), StandardCopyOption.REPLACE_EXISTING);
            return true;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public int deleteTempOlderThan(Duration age) {
        if (!Files.isDirectory(temp)) {
            return 0;
        }
        Instant cutoff = Instant.now().minus(age);
        int deleted = 0;
        try (Stream<Path> files = Files.list(temp)) {
            for (Path p : (Iterable<Path>) files::iterator) {
                if (Files.getLastModifiedTime(p).toInstant().isBefore(cutoff) && Files.deleteIfExists(p)) {
                    deleted++;
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return deleted;
    }

    private static String extensionOf(String contentType) {
        return switch (contentType == null ? "" : contentType) {
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
    }
}
