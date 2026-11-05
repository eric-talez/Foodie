package com.foodie.api.catalog;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SampleLocationRepository extends JpaRepository<SampleLocation, UUID> {
    List<SampleLocation> findAllByActiveTrueOrderByDisplayOrderAscIdAsc();
}
