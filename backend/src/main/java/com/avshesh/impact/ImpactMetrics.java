package com.avshesh.impact;

import com.avshesh.scan.Category;

/** Conversion factors for impact numbers. Swappable so the figures can be changed without touching callers. */
public interface ImpactMetrics {

    double co2SavedKg(Category category, double kgDiverted);

    double compostedKg(Category category, double kgDiverted);
}
