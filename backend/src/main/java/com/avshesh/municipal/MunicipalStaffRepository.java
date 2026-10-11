package com.avshesh.municipal;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MunicipalStaffRepository extends JpaRepository<MunicipalStaff, Long> {

    List<MunicipalStaff> findByWardIdOrderByIdDesc(Long wardId);

    List<MunicipalStaff> findAllByOrderByIdDesc();

    java.util.Optional<MunicipalStaff> findByUserId(Long userId);
}
