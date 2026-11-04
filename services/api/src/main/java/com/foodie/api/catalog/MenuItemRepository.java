package com.foodie.api.catalog;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MenuItemRepository extends JpaRepository<MenuItem, UUID> {

}
