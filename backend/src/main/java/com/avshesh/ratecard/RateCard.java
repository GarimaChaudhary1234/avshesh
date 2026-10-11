package com.avshesh.ratecard;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "rate_cards")
@Getter
@Setter
@NoArgsConstructor
public class RateCard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long collectorId;
    private String itemCode;

    /** Rs/kg the collector pays the household. */
    private double buyRate;

    /** Rs/kg the collector earns selling onward. */
    private double sellRate;

    public RateCard(Long collectorId, String itemCode, double buyRate, double sellRate) {
        this.collectorId = collectorId;
        this.itemCode = itemCode;
        this.buyRate = buyRate;
        this.sellRate = sellRate;
    }
}
