package com.foodie.api.servicearea;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import com.foodie.api.catalog.CatalogDtos;
import com.foodie.api.catalog.FeePolicy;
import com.foodie.api.catalog.FeePolicyRepository;
import com.foodie.api.catalog.Restaurant;
import com.foodie.api.catalog.RestaurantRepository;
import com.foodie.api.catalog.SampleLocation;
import com.foodie.api.catalog.SampleLocationRepository;
import com.foodie.api.common.ApiError.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ServiceAreaService {

    private final SampleLocationRepository locations;
    private final RestaurantRepository restaurants;
    private final FeePolicyRepository policies;

    public ServiceAreaService(SampleLocationRepository locations, RestaurantRepository restaurants,
                              FeePolicyRepository policies) {
        this.locations = locations;
        this.restaurants = restaurants;
        this.policies = policies;
    }

    public DeliveryEligibility evaluate(UUID locationId, Restaurant restaurant) {
        return evaluate(location(locationId), restaurant, policy());
    }

    public CatalogDtos.RestaurantSearchResponse search(UUID locationId, DeliveryMode mode) {
        var location = location(locationId);
        if (!location.inCoverage()) {
            return new CatalogDtos.RestaurantSearchResponse(locationId, false, mode, List.of());
        }
        var policy = policy();
        var summaries = restaurants.findAllByActiveTrueOrderByNameAscIdAsc().stream()
                .map(restaurant -> new Candidate(restaurant, evaluate(location, restaurant, policy)))
                .filter(candidate -> mode == DeliveryMode.GROUPED
                        ? candidate.eligibility().groupedAvailable() : candidate.eligibility().directAvailable())
                .sorted(Comparator.comparingDouble((Candidate candidate) -> candidate.eligibility().distanceMiles())
                        .thenComparing(candidate -> candidate.restaurant().name()))
                .map(candidate -> summary(candidate, mode, policy))
                .toList();
        return new CatalogDtos.RestaurantSearchResponse(locationId, true, mode, summaries);
    }

    private SampleLocation location(UUID locationId) {
        return locations.findById(locationId).filter(SampleLocation::active)
                .orElseThrow(() -> new NotFoundException("LOCATION_NOT_FOUND", "Location not found"));
    }

    private FeePolicy policy() {
        return policies.findByActiveTrue().orElseThrow(() -> new IllegalStateException("No active fee policy"));
    }

    private DeliveryEligibility evaluate(SampleLocation location, Restaurant restaurant, FeePolicy policy) {
        double miles = DistanceCalculator.miles(location.latitude(), location.longitude(),
                restaurant.latitude(), restaurant.longitude());
        return DeliveryEligibility.forDistance(miles, location.inCoverage(),
                policy.groupedMaxDistanceMiles(), policy.directMaxDistanceMiles());
    }

    private CatalogDtos.RestaurantSummary summary(Candidate candidate, DeliveryMode mode, FeePolicy policy) {
        var restaurant = candidate.restaurant();
        boolean grouped = mode == DeliveryMode.GROUPED;
        int fee = policy.groupedDeliveryFeeCents() + (grouped ? 0 : policy.directSurchargeCents());
        return new CatalogDtos.RestaurantSummary(restaurant.id(), restaurant.slug(), restaurant.name(),
                restaurant.description(), restaurant.city(), restaurant.cuisine(), candidate.eligibility().distanceMiles(),
                mode, fee, grouped ? 45 : 25, grouped ? 60 : 35);
    }

    private record Candidate(Restaurant restaurant, DeliveryEligibility eligibility) {}
}
