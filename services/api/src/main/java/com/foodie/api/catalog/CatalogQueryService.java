package com.foodie.api.catalog;

import java.util.List;

import com.foodie.api.common.ApiError.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CatalogQueryService {

    private final SampleLocationRepository locations;
    private final RestaurantRepository restaurants;

    public CatalogQueryService(SampleLocationRepository locations, RestaurantRepository restaurants) {
        this.locations = locations;
        this.restaurants = restaurants;
    }

    public List<CatalogDtos.Location> listLocations() {
        return locations.findAllByActiveTrueOrderByDisplayOrderAscIdAsc().stream()
                .map(location -> new CatalogDtos.Location(location.id(), location.label(),
                        location.city(), location.inCoverage()))
                .toList();
    }

    public CatalogDtos.RestaurantMenu getRestaurant(String slug) {
        var restaurant = restaurants.findBySlugAndActiveTrue(slug)
                .orElseThrow(() -> new NotFoundException("RESTAURANT_NOT_FOUND", "Restaurant not found"));
        return new CatalogDtos.RestaurantMenu(restaurant.id(), restaurant.slug(), restaurant.name(),
                restaurant.description(), restaurant.city(), restaurant.cuisine(),
                restaurant.categories().stream().filter(MenuCategory::active).map(this::category).toList());
    }

    private CatalogDtos.Category category(MenuCategory category) {
        return new CatalogDtos.Category(category.id(), category.name(),
                category.items().stream().filter(MenuItem::active).map(this::item).toList());
    }

    private CatalogDtos.Item item(MenuItem item) {
        return new CatalogDtos.Item(item.id(), item.name(), item.description(), item.priceCents(),
                item.imageReference(), item.modifierGroups().stream().filter(ModifierGroup::active)
                        .map(this::group).toList());
    }

    private CatalogDtos.Group group(ModifierGroup group) {
        return new CatalogDtos.Group(group.id(), group.name(), group.minSelections(), group.maxSelections(),
                group.options().stream().filter(ModifierOption::active)
                        .map(option -> new CatalogDtos.Option(option.id(), option.label(), option.priceDeltaCents()))
                        .toList());
    }
}
