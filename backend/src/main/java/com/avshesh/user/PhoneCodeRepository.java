package com.avshesh.user;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

interface PhoneCodeRepository extends JpaRepository<PhoneCode, Long> {

    Optional<PhoneCode> findFirstByPhoneAndPurposeAndConsumedFalseOrderByIdDesc(String phone,
                                                                              PhoneVerificationService.Purpose purpose);

    List<PhoneCode> findByPhoneAndPurposeAndConsumedFalse(String phone, PhoneVerificationService.Purpose purpose);
}
