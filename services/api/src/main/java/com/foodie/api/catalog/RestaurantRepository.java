package com.foodie.api.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RestaurantRepository extends JpaRepository<Restaurant, UUID> {
    List<Restaurant> findAllByActiveTrueOrderByNameAscIdAsc();

    Optional<Restaurant> findBySlugAndActiveTrue(String slug);
}
