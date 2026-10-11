package com.avshesh.ward;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A municipal ward with its real boundary. */
@Entity
@Table(name = "wards")
@Getter
@Setter
@NoArgsConstructor
public class Ward {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String city;
    private String wardNo;
    private String zone;
    private Integer households;
    private Integer population;

    /** Rings of "lng lat,lng lat,..." separated by "|". The first ring is the outer boundary, the rest are holes. */
    private String boundary;

    private double minLat;
    private double maxLat;
    private double minLng;
    private double maxLng;
}
