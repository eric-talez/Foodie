package com.foodie.api.catalog;

import java.util.List;
import java.util.UUID;

import com.foodie.api.servicearea.DeliveryMode;

public final class CatalogDtos {

    private CatalogDtos() {}

    public record Location(UUID id, String label, String city, boolean inCoverage) {}

    public record RestaurantSearchResponse(UUID locationId, boolean inCoverage, DeliveryMode deliveryMode,
                                           List<RestaurantSummary> restaurants) {
        public RestaurantSearchResponse {
            restaurants = List.copyOf(restaurants);
        }
    }

    public record RestaurantSummary(UUID id, String slug, String name, String description, String city,
                                    String cuisine, double distanceMiles, DeliveryMode deliveryMode,
                                    int deliveryFeeCents, int estimatedMinutesMin, int estimatedMinutesMax) {
        public RestaurantSummary {
            distanceMiles = Math.round(distanceMiles * 10) / 10.0;
        }
    }

    public record RestaurantMenu(UUID id, String slug, String name, String description,
                                 String city, String cuisine, List<Category> categories) {
        public RestaurantMenu {
            categories = List.copyOf(categories);
        }
    }

    public record Category(UUID id, String name, List<Item> items) {
        public Category {
            items = List.copyOf(items);
        }
    }

    public record Item(UUID id, String name, String description, int priceCents,
                       String imageReference, List<Group> modifierGroups) {
        public Item {
            modifierGroups = List.copyOf(modifierGroups);
        }
    }

    public record Group(UUID id, String name, int minSelections, int maxSelections, List<Option> options) {
        public Group {
            options = List.copyOf(options);
        }
    }

    public record Option(UUID id, String label, int priceDeltaCents) {}
}
