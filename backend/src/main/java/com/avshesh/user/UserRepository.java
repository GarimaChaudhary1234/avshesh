package com.avshesh.user;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByPhone(String phone);

    List<User> findByRole(Role role);

    long countByRole(Role role);

    long countByRoleAndWardId(Role role, Long wardId);

    List<User> findByRoleAndWardIdIsNotNullOrderByIdDesc(Role role);

    /** Rows of {wardId, role, count}: every ward at once instead of one query per ward. */
    @org.springframework.data.jpa.repository.Query("select u.wardId, u.role, count(u) from User u where u.wardId is not null group by u.wardId, u.role")
    List<Object[]> countByWardAndRole();
}
