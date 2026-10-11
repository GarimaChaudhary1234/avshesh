package com.avshesh.scan;

import java.util.List;
import java.util.Optional;

/** The set of waste items the platform knows about. */
public interface ItemCatalog {

    List<WasteItem> all();

    Optional<WasteItem> find(String code);
}
