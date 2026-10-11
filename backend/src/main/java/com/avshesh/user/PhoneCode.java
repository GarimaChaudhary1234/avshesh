package com.avshesh.user;

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

/** A 6 digit code sent by SMS. Only a hash of it is stored. */
@Entity
@Table(name = "phone_codes")
@Getter
@Setter
@NoArgsConstructor
class PhoneCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String phone;

    @Enumerated(EnumType.STRING)
    private PhoneVerificationService.Purpose purpose;

    private String codeHash;
    private LocalDateTime expiresAt;
    private boolean consumed;
    private LocalDateTime createdAt = LocalDateTime.now();
}
