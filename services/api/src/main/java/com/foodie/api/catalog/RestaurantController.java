package com.foodie.api.catalog;

import java.util.UUID;

import com.foodie.api.servicearea.DeliveryMode;
import com.foodie.api.servicearea.ServiceAreaService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/restaurants")
public class RestaurantController {

    private final CatalogQueryService catalog;
    private final ServiceAreaService serviceArea;

    public RestaurantController(CatalogQueryService catalog, ServiceAreaService serviceArea) {
        this.catalog = catalog;
        this.serviceArea = serviceArea;
    }

    @GetMapping
    public CatalogDtos.RestaurantSearchResponse search(@RequestParam UUID locationId, @RequestParam DeliveryMode mode) {
        return serviceArea.search(locationId, mode);
    }

    @GetMapping("/{slug}")
    public CatalogDtos.RestaurantMenu getRestaurant(@PathVariable String slug) {
        return catalog.getRestaurant(slug);
    }
}
