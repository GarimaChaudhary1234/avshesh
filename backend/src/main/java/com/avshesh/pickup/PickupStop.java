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
@Table(name = "pickup_stops")
@Getter
@Setter
@NoArgsConstructor
public class PickupStop {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long pickupId;
    private Long listingId;
    private int seq;
    private Double actualKg;
    private Double amountPaid;
    /** The dealer's resale margin on this stop, written down when it was done (later rate changes do not rewrite it). */
    /** What the dealer paid per kg and resells for, written down when the stop was done. */
    private Double buyRate;
    private Double sellRate;
    private Double profit;

    @Enumerated(EnumType.STRING)
    private PaymentMode paymentMode;

    private LocalDateTime doneAt;

    @Enumerated(EnumType.STRING)
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    private String disputeNote;
    private LocalDateTime confirmedAt;
    private String resolutionNote;
    private LocalDateTime resolvedAt;

    public boolean isDone() {
        return doneAt != null;
    }
}
