package com.foodie.api.servicearea;

import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;

import com.foodie.api.catalog.FeePolicy;
import com.foodie.api.catalog.FeePolicyRepository;
import com.foodie.api.catalog.Restaurant;
import com.foodie.api.catalog.RestaurantRepository;
import com.foodie.api.catalog.SampleLocation;
import com.foodie.api.catalog.SampleLocationRepository;
import com.foodie.api.common.ApiError.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

class ServiceAreaServiceTest {

    private static final UUID LOCATION_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");

    private SampleLocation location;
    private FeePolicy policy;
    private List<Restaurant> availableRestaurants = List.of();
    private final SampleLocationRepository locations = repository(SampleLocationRepository.class, "findById",
            arguments -> LOCATION_ID.equals(arguments[0]) ? Optional.ofNullable(location) : Optional.empty());
    private final RestaurantRepository restaurants = repository(RestaurantRepository.class,
            "findAllByActiveTrueOrderByNameAscIdAsc", arguments -> availableRestaurants);
    private final FeePolicyRepository policies = repository(FeePolicyRepository.class,
            "findByActiveTrue", arguments -> Optional.of(policy));
    private final ServiceAreaService service = new ServiceAreaService(locations, restaurants, policies);

    @BeforeEach
    void setUp() {
        location = BeanUtils.instantiateClass(SampleLocation.class);
        ReflectionTestUtils.setField(location, "id", LOCATION_ID);
        ReflectionTestUtils.setField(location, "active", true);
        ReflectionTestUtils.setField(location, "inCoverage", true);

        policy = BeanUtils.instantiateClass(FeePolicy.class);
        ReflectionTestUtils.setField(policy, "groupedMaxDistanceMiles", 4.0);
        ReflectionTestUtils.setField(policy, "directMaxDistanceMiles", 6.0);
        ReflectionTestUtils.setField(policy, "groupedDeliveryFeeCents", 699);
        ReflectionTestUtils.setField(policy, "directSurchargeCents", 450);
    }

    @Test
    void evaluatesControlledCoordinatesOnBothSidesOfEachBoundary() {
        var atFour = service.evaluate(LOCATION_ID, restaurant("Four", 0.05789263375195905));
        var overFour = service.evaluate(LOCATION_ID, restaurant("Over four", 0.057893));
        var atSix = service.evaluate(LOCATION_ID, restaurant("Six", 0.08683895062793857));
        var overSix = service.evaluate(LOCATION_ID, restaurant("Over six", 0.08684));

        assertThat(atFour.distanceMiles()).isCloseTo(4, within(0.000000001));
        assertThat(atFour.groupedAvailable()).isTrue();
        assertThat(overFour.groupedAvailable()).isFalse();
        assertThat(overFour.directAvailable()).isTrue();
        assertThat(atSix.distanceMiles()).isCloseTo(6, within(0.000000001));
        assertThat(atSix.directAvailable()).isTrue();
        assertThat(overSix.directAvailable()).isFalse();
    }

    @Test
    void filtersUsingRawDistanceAndSortsBeforeRoundingWithNameForExactTies() {
        var farther = restaurant("A farther", 0.0146);
        var tiedZ = restaurant("Z tie", 0.0145);
        var tiedA = restaurant("A tie", 0.0145);
        var overFour = restaurant("Over four", 0.0579);
        availableRestaurants = List.of(farther, tiedZ, overFour, tiedA);

        var result = service.search(LOCATION_ID, DeliveryMode.GROUPED);

        assertThat(result.locationId()).isEqualTo(LOCATION_ID);
        assertThat(result.inCoverage()).isTrue();
        assertThat(result.deliveryMode()).isEqualTo(DeliveryMode.GROUPED);
        assertThat(result.restaurants()).extracting(summary -> summary.name())
                .containsExactly("A tie", "Z tie", "A farther");
        assertThat(result.restaurants()).allSatisfy(summary -> {
            assertThat(summary.distanceMiles()).isEqualTo(1.0);
            assertThat(summary.deliveryMode()).isEqualTo(DeliveryMode.GROUPED);
            assertThat(summary.deliveryFeeCents()).isEqualTo(699);
            assertThat(summary.estimatedMinutesMin()).isEqualTo(45);
            assertThat(summary.estimatedMinutesMax()).isEqualTo(60);
        });
        assertThatThrownBy(() -> result.restaurants().clear()).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void directUsesTheTotalPolicyFeeAndExcludesJustOverSixEvenWhenItRoundsToSix() {
        availableRestaurants = List.of(restaurant("Over six", 0.08684), restaurant("Direct only", 0.0724));

        var result = service.search(LOCATION_ID, DeliveryMode.DIRECT);

        assertThat(result.restaurants()).hasSize(1);
        var summary = result.restaurants().getFirst();
        assertThat(summary.name()).isEqualTo("Direct only");
        assertThat(summary.distanceMiles()).isEqualTo(5.0);
        assertThat(summary.deliveryMode()).isEqualTo(DeliveryMode.DIRECT);
        assertThat(summary.deliveryFeeCents()).isEqualTo(1149);
        assertThat(summary.estimatedMinutesMin()).isEqualTo(25);
        assertThat(summary.estimatedMinutesMax()).isEqualTo(35);
    }

    @Test
    void consumesActivePolicyRatherThanHardCodingFeesAndRanges() {
        ReflectionTestUtils.setField(policy, "groupedMaxDistanceMiles", 2.0);
        ReflectionTestUtils.setField(policy, "directMaxDistanceMiles", 3.0);
        ReflectionTestUtils.setField(policy, "groupedDeliveryFeeCents", 500);
        ReflectionTestUtils.setField(policy, "directSurchargeCents", 200);
        availableRestaurants = List.of(restaurant("Near", 0.0145), restaurant("Far", 0.05));

        assertThat(service.search(LOCATION_ID, DeliveryMode.GROUPED).restaurants())
                .singleElement().satisfies(summary -> assertThat(summary.deliveryFeeCents()).isEqualTo(500));
        assertThat(service.search(LOCATION_ID, DeliveryMode.DIRECT).restaurants())
                .singleElement().satisfies(summary -> assertThat(summary.deliveryFeeCents()).isEqualTo(700));
    }

    @Test
    void outsideCoverageReturnsEmptySearchAndUnavailableEligibility() {
        ReflectionTestUtils.setField(location, "inCoverage", false);
        assertThat(service.search(LOCATION_ID, DeliveryMode.GROUPED).inCoverage()).isFalse();
        assertThat(service.search(LOCATION_ID, DeliveryMode.GROUPED).restaurants()).isEmpty();
        assertThat(service.search(LOCATION_ID, DeliveryMode.DIRECT).restaurants()).isEmpty();
        var eligibility = service.evaluate(LOCATION_ID, restaurant("Next door", 0));
        assertThat(eligibility.inCoverage()).isFalse();
        assertThat(eligibility.groupedAvailable()).isFalse();
        assertThat(eligibility.directAvailable()).isFalse();
    }

    @Test
    void unknownOrInactiveLocationUsesTheApprovedNotFoundContract() {
        var activeLocation = location;
        location = null;
        assertMissingLocation();
        location = activeLocation;
        ReflectionTestUtils.setField(location, "active", false);
        assertMissingLocation();
    }

    private void assertMissingLocation() {
        assertThatThrownBy(() -> service.search(LOCATION_ID, DeliveryMode.GROUPED))
                .isInstanceOfSatisfying(NotFoundException.class,
                        exception -> assertThat(exception.code()).isEqualTo("LOCATION_NOT_FOUND"));
        assertThatThrownBy(() -> service.evaluate(LOCATION_ID, restaurant("Near", 0)))
                .isInstanceOfSatisfying(NotFoundException.class,
                        exception -> assertThat(exception.code()).isEqualTo("LOCATION_NOT_FOUND"));
    }

    private Restaurant restaurant(String name, double longitude) {
        var restaurant = BeanUtils.instantiateClass(Restaurant.class);
        ReflectionTestUtils.setField(restaurant, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(restaurant, "slug", name.toLowerCase().replace(' ', '-'));
        ReflectionTestUtils.setField(restaurant, "name", name);
        ReflectionTestUtils.setField(restaurant, "description", "Fictional demo restaurant");
        ReflectionTestUtils.setField(restaurant, "city", "Demo city");
        ReflectionTestUtils.setField(restaurant, "cuisine", "Bowls");
        ReflectionTestUtils.setField(restaurant, "longitude", longitude);
        ReflectionTestUtils.setField(restaurant, "active", true);
        return restaurant;
    }

    private static <T> T repository(Class<T> type, String query, Function<Object[], Object> result) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] {type},
                (proxy, method, arguments) -> {
                    if (!method.getName().equals(query)) {
                        throw new UnsupportedOperationException(method.getName());
                    }
                    return result.apply(arguments);
                }));
    }
}
