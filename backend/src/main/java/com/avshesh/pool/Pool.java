package com.avshesh.pool;

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
@Table(name = "pools")
@Getter
@Setter
@NoArgsConstructor
public class Pool {

    /** {lat, lng} of the pool centre. */
    public double[] center() {
        return centerLat != null && centerLng != null
                ? new double[] {centerLat, centerLng}
                : com.avshesh.common.GeoUtil.center(geohash);
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String geohash;

    /** Where the pool is centred: the first home that joined it. Null only on rows created before this existed. */
    private Double centerLat;

    private Double centerLng;

    @Enumerated(EnumType.STRING)
    private WasteType wasteType;

    @Enumerated(EnumType.STRING)
    private PoolStatus status = PoolStatus.FILLING;

    private double totalKg;
    private double estProfit;
    private Long collectorId;
    private Long wardId;
    private LocalDateTime createdAt = LocalDateTime.now();
}
