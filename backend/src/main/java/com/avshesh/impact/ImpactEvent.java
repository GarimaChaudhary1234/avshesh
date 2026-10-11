package com.avshesh.impact;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "impact_events")
@Getter
@Setter
@NoArgsConstructor
public class ImpactEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String areaGeohash;
    private Long wardId;
    private String category;
    private double kgDiverted;

    @Column(name = "co2_saved_kg")
    private double co2SavedKg;

    private double compostedKg;
    private double paidToHousehold;
    /** The collection (stop) and the pickup (trip) this event was made from. */
    private Long stopId;
    private Long pickupId;
    private LocalDateTime createdAt = LocalDateTime.now();
}
