package com.avshesh.scan;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

import com.avshesh.common.ApiException;

class BedrockWasteScannerTest {

    // The client is only used by detect(), not by parse(), so null is fine here.
    private final BedrockWasteScanner scanner = new BedrockWasteScanner(null, new WasteCatalog(), "model");

    @Test
    void acceptsAClearCatalogCode() {
        WasteScanner.Detection d = scanner.parse("PET_BOTTLE|0.92");
        assertEquals("PET_BOTTLE", d.itemCode());
        assertEquals(0.92, d.confidence(), 1e-9);
    }

    @Test
    void toleratesCaseWhitespaceAndExtraLines() {
        WasteScanner.Detection d = scanner.parse("  newspaper | 0.8 \nSome extra explanation");
        assertEquals("NEWSPAPER", d.itemCode());
    }

    @Test
    void rejectsUnknownCodes() {
        assertThrows(ApiException.class, () -> scanner.parse("UNKNOWN|0.9"));
        assertThrows(ApiException.class, () -> scanner.parse("LAPTOP|0.9"));
    }

    @Test
    void rejectsLowConfidenceAndMissingConfidence() {
        assertThrows(ApiException.class, () -> scanner.parse("PET_BOTTLE|0.2"));
        assertThrows(ApiException.class, () -> scanner.parse("PET_BOTTLE"));
    }

    @Test
    void rejectsEmptyAnswers() {
        assertThrows(ApiException.class, () -> scanner.parse(""));
        assertThrows(ApiException.class, () -> scanner.parse(null));
    }
}
