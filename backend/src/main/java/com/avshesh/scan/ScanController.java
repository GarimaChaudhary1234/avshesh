package com.avshesh.scan;

import java.io.IOException;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.avshesh.scan.ScanService.ScanResult;
import com.avshesh.security.CurrentUserId;
import com.avshesh.security.HouseholdOnly;

@RestController
@RequestMapping("/api/v1")
public class ScanController {

    public record ScanMode(String scanner) {
    }

    private final ScanService scanService;
    private final ItemCatalog catalog;
    private final WasteScanner scanner;

    public ScanController(ScanService scanService, ItemCatalog catalog, WasteScanner scanner) {
        this.scanService = scanService;
        this.catalog = catalog;
        this.scanner = scanner;
    }

    /** Public: tells the frontend whether photos are really analysed ("bedrock") or the user picks ("mock"). */
    @GetMapping("/scan/mode")
    public ScanMode mode() {
        return new ScanMode(scanner.mode());
    }

    @HouseholdOnly
    @PostMapping("/scan")
    public ScanResult scan(@CurrentUserId Long userId,
                           @RequestPart("photo") MultipartFile photo,
                           @RequestParam(value = "hint", required = false) String hint) throws IOException {
        return scanService.scan(userId, photo.getBytes(), photo.getContentType(), hint);
    }

    /** Public: the frontend uses it for item names in dropdowns. */
    @GetMapping("/catalog")
    public List<WasteItem> catalog() {
        return catalog.all();
    }
}
