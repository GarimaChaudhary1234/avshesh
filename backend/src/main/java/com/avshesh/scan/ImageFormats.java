package com.avshesh.scan;

import java.util.Optional;

/** Recognises the image types we accept from the first bytes of a file, not from the name or header the client sent. */
public final class ImageFormats {

    private ImageFormats() {
    }

    /** The real content type of a JPEG, PNG, GIF or WEBP image, or empty for anything else. */
    public static Optional<String> detect(byte[] b) {
        if (b == null || b.length < 12) {
            return Optional.empty();
        }
        if ((b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return Optional.of("image/jpeg");
        }
        if ((b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
            return Optional.of("image/png");
        }
        if (b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') {
            return Optional.of("image/gif");
        }
        if (b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return Optional.of("image/webp");
        }
        return Optional.empty();
    }
}
