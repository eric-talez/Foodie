package com.foodie.api.catalog;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/locations")
public class LocationController {

    private final CatalogQueryService catalog;

    public LocationController(CatalogQueryService catalog) {
        this.catalog = catalog;
    }

    @GetMapping
    public List<CatalogDtos.Location> listLocations() {
        return catalog.listLocations();
    }
}
