package com.avshesh.municipal;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MunicipalRequestRepository extends JpaRepository<MunicipalRequest, Long> {

    List<MunicipalRequest> findByHouseholdIdOrderByIdDesc(Long householdId);

    boolean existsByHouseholdIdAndStatusIn(Long householdId, java.util.Collection<RequestStatus> statuses);

    List<MunicipalRequest> findAllByOrderByIdDesc();

    List<MunicipalRequest> findByWardIdOrderByIdDesc(Long wardId);

    List<MunicipalRequest> findByStaffIdOrderByScheduledForAsc(Long staffId);

    long countByStatus(RequestStatus status);

    /** Rows of {wardId, number of requests waiting for the ward officer}. */
    @org.springframework.data.jpa.repository.Query("select r.wardId, count(r) from MunicipalRequest r where r.status = com.avshesh.municipal.RequestStatus.OPEN and r.wardId is not null group by r.wardId")
    List<Object[]> openByWard();

    long countByStatusAndWardId(RequestStatus status, Long wardId);
}
