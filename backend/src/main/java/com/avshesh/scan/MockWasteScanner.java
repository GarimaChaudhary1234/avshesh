package com.avshesh.scan;

import java.util.Locale;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.avshesh.common.ApiException;

/**
 * Stand-in for Bedrock so the whole flow runs without AWS. It cannot read photos: the caller has to
 * name the item, otherwise it refuses instead of guessing.
 */
@Component
@ConditionalOnProperty(name = "avshesh.scanner", havingValue = "mock", matchIfMissing = true)
public class MockWasteScanner implements WasteScanner {

    private final ItemCatalog catalog;

    public MockWasteScanner(ItemCatalog catalog) {
        this.catalog = catalog;
    }

    @Override
    public Detection detect(byte[] image, String contentType, String hint) {
        if (hint == null || hint.isBlank()) {
            throw ApiException.badRequest("SCAN_MOCK_NEEDS_ITEM",
                    "The demo scanner cannot read photos. Pick the item in Demo mode, or enable the Bedrock scanner.");
        }
        String h = hint.toLowerCase(Locale.ROOT);
        return catalog.all().stream()
                .filter(i -> i.code().toLowerCase(Locale.ROOT).equals(h)
                        || i.name().toLowerCase(Locale.ROOT).contains(h))
                .findFirst()
                .map(i -> new Detection(i.code(), 1.0))
                .orElseThrow(() -> ApiException.badRequest("ITEM_UNKNOWN", "Unknown item"));
    }

    @Override
    public String mode() {
        return "mock";
    }
}
