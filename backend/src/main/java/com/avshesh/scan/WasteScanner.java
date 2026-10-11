package com.avshesh.scan;

/** Identifies waste from a photo. The result must be a code from {@link ItemCatalog}. */
public interface WasteScanner {

    record Detection(String itemCode, double confidence) {
    }

    /** @param hint optional item name from the client, only used by the mock scanner for demos */
    Detection detect(byte[] image, String contentType, String hint);

    /** "bedrock" if the photo is really analysed, "mock" if the client must pick the item. */
    String mode();
}
