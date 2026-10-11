package com.avshesh.impact;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ImpactEventRepository extends JpaRepository<ImpactEvent, Long> {

    List<ImpactEvent> findByAreaGeohashStartingWith(String prefix);

    List<ImpactEvent> findByWardId(Long wardId);

    String TOTALS = "select new com.avshesh.impact.ImpactTotals(coalesce(sum(e.kgDiverted), 0.0),"
            + " coalesce(sum(case when e.category <> 'WET' then e.kgDiverted else 0.0 end), 0.0),"
            + " coalesce(sum(e.compostedKg), 0.0), coalesce(sum(e.co2SavedKg), 0.0),"
            + " coalesce(sum(e.paidToHousehold), 0.0), count(e),"
            // trips: each pickup once (an old event without a pickup counts as its own)
            + " count(distinct coalesce(e.pickupId, -e.id))) from ImpactEvent e";

    @Query(TOTALS)
    ImpactTotals totalsAll();

    @Query("select min(e.createdAt) from ImpactEvent e")
    java.time.LocalDateTime firstEventAll();

    @Query("select min(e.createdAt) from ImpactEvent e where e.wardId = :ward")
    java.time.LocalDateTime firstEventForWard(@Param("ward") Long wardId);

    @Query("select distinct e.wardId from ImpactEvent e where e.wardId is not null")
    List<Long> wardsWithEvents();

    @Query(TOTALS + " where e.wardId = :ward")
    ImpactTotals totalsForWard(@Param("ward") Long wardId);

    @Query(TOTALS + " where e.areaGeohash like :pattern escape '\\'")
    ImpactTotals totalsForArea(@Param("pattern") String pattern);
}
