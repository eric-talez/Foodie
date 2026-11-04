package com.foodie.api.catalog;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FeePolicyRepository extends JpaRepository<FeePolicy, UUID> {
    Optional<FeePolicy> findByActiveTrue();
}
