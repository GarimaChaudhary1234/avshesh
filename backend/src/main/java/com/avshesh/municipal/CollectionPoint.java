package com.avshesh.municipal;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** An authorised place to hand in hazardous waste. Managed by the municipal corporation. */
@Entity
@Table(name = "collection_points")
@Getter
@Setter
@NoArgsConstructor
public class CollectionPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String address;
    private double lat;
    private double lng;
    private String accepts;
    private String openingHours;
    private boolean active = true;
    private Long wardId;
    private LocalDateTime createdAt = LocalDateTime.now();
}
