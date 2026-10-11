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

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    private Role role;

    private String name;
    private String phone;
    private Double lat;
    private Double lng;
    private String geohash;
    private Long wardId;
    private boolean phoneVerified;
    private boolean active = true;
    private String language = "en";
    private String registeredIpHash;
    private String passwordHash;
    private LocalDateTime createdAt = LocalDateTime.now();
}
