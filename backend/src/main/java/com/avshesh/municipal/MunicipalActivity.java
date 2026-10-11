package com.avshesh.municipal;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One thing a municipal officer did. {@code code} says what; the screen turns it into a sentence in the user's language. */
@Entity
@Table(name = "municipal_activity")
@Getter
@Setter
@NoArgsConstructor
public class MunicipalActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long actorId;
    private Long wardId;
    private String code;
    private String detail;
    private LocalDateTime createdAt = LocalDateTime.now();
}
