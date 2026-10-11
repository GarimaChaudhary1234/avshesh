package com.avshesh.pickup;

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

@Entity
@Table(name = "pickups")
@Getter
@Setter
@NoArgsConstructor
public class Pickup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long poolId;
    private Long collectorId;
    private LocalDateTime scheduledStart;
    private LocalDateTime scheduledEnd;

    @Enumerated(EnumType.STRING)
    private PickupStatus status = PickupStatus.SCHEDULED;
}
