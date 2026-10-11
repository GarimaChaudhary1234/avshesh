package com.avshesh.municipal;

import java.time.LocalDate;
import java.time.LocalDateTime;

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

/** A household asking the municipal corporation to collect waste that nobody buys. */
@Entity
@Table(name = "municipal_requests")
@Getter
@Setter
@NoArgsConstructor
public class MunicipalRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long householdId;
    private String itemCode;
    private double estKg;
    private String note;
    private String geohash;
    private Long wardId;
    private Long staffId;

    @Enumerated(EnumType.STRING)
    private RequestStatus status = RequestStatus.OPEN;

    private LocalDate scheduledFor;
    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime resolvedAt;
}
