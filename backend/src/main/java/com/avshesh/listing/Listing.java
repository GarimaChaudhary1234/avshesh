package com.avshesh.listing;

import java.time.LocalDate;
import java.time.LocalDateTime;

import com.avshesh.scan.Category;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "listings")
@Getter
@Setter
@NoArgsConstructor
public class Listing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long ownerId;
    private String itemCode;

    @Enumerated(EnumType.STRING)
    private Category category;

    private double estKg;
    private LocalDate readyFrom;
    private String photoKey;

    @Enumerated(EnumType.STRING)
    private ListingMode mode;

    private Long poolId;

    @Enumerated(EnumType.STRING)
    private ListingStatus status = ListingStatus.OPEN;

    private LocalDateTime createdAt = LocalDateTime.now();
}
