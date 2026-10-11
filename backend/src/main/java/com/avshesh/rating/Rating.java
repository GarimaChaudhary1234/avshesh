package com.avshesh.rating;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A household's 1-5 star rating of the collector who took one of their listings. */
@Entity
@Table(name = "ratings")
@Getter
@Setter
@NoArgsConstructor
public class Rating {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long listingId;
    private Long householdId;
    private Long collectorId;
    private int stars;

    /** 1 for a normal rating; lower when it looks like the dealer rating themselves. */
    private double weight = 1.0;

    private String householdIpHash;
    private String comment;
    private LocalDateTime createdAt = LocalDateTime.now();
}
