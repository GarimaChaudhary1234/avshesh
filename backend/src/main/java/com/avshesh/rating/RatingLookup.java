package com.avshesh.rating;

import java.util.Collection;
import java.util.Map;

/** Read-only ratings of collectors, for the scan result and the municipal dealer list. */
public interface RatingLookup {

    /** Collectors nobody has rated yet are simply missing from the map. */
    Map<Long, RatingSummary> forCollectors(Collection<Long> collectorIds);
}
