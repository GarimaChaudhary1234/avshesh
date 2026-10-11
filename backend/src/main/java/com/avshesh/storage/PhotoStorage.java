package com.avshesh.storage;

import java.time.Duration;
import java.util.regex.Pattern;

/**
 * Scan photos start in a temporary area. A photo that ends up in a listing is moved to permanent storage; the
 * rest are deleted after a while. On S3 the same split is a prefix ({@code tmp/} and {@code kept/}) plus a
 * lifecycle rule that expires {@code tmp/} after one day.
 */
public interface PhotoStorage {

    /** Keys are made by the storage itself, so anything else (such as "../x") is refused before it reaches a disk or bucket. */
    Pattern KEY = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|gif|webp)");

    /** Stores a scan photo temporarily and returns its key. */
    String saveTemp(byte[] image, String contentType);

    /** Moves a photo from the temporary area to permanent storage. False if there is no such photo. */
    boolean keep(String key);

    /** Deletes temporary photos older than {@code age}. Returns how many were deleted. */
    int deleteTempOlderThan(Duration age);
}
