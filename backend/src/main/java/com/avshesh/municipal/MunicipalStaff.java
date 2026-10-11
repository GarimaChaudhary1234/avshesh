package com.avshesh.municipal;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A ward's waste collection worker, who gets assigned to pickup requests. */
@Entity
@Table(name = "municipal_staff")
@Getter
@Setter
@NoArgsConstructor
public class MunicipalStaff {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long wardId;
    private String name;
    private String phone;
    private boolean active = true;
    /** The login of this worker, if they have one. */
    private Long userId;
}
