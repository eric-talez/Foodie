package com.foodie.api.catalog;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/restaurants")
public class RestaurantController {

    private final CatalogQueryService catalog;

    public RestaurantController(CatalogQueryService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/{slug}")
    public CatalogDtos.RestaurantMenu getRestaurant(@PathVariable String slug) {
        return catalog.getRestaurant(slug);
    }
}
