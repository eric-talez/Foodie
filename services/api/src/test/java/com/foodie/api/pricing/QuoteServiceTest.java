package com.foodie.api.pricing;

import java.lang.reflect.Proxy;
import java.util.*;
import java.util.function.Function;

import com.foodie.api.catalog.*;
import com.foodie.api.servicearea.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.*;

class QuoteServiceTest {
    final QuoteFixture fixture = new QuoteFixture();

    @BeforeEach
    void setUp() { fixture.setUp(); }

    @Test
    void quotesExactGroupedAndDirectTotalsFromServerPrices() {
        var grouped = fixture.service.quote(fixture.request(DeliveryMode.GROUPED, fixture.line(1)));
        assertThat(grouped).isEqualTo(new QuoteResponse("USD", 3500, 175, 699, 315, 4689,
                DeliveryMode.GROUPED, 45, 60, true));
        var direct = fixture.service.quote(fixture.request(DeliveryMode.DIRECT, fixture.line(1)));
        assertThat(direct.totalCents()).isEqualTo(5139);
        assertThat(direct.deliveryFeeCents()).isEqualTo(1149);
        assertThat(direct.estimatedMinutesMin()).isEqualTo(25);
        assertThat(direct.estimatedMinutesMax()).isEqualTo(35);
    }

    @Test
    void calculatesInternalCommissionFromValidatedSubtotalAndActivePolicyWithoutChangingCustomerQuote() {
        var request = fixture.request(DeliveryMode.GROUPED, fixture.line(1));
        var calculation = fixture.service.calculate(request);
        assertThat(calculation.restaurantCommissionCents()).isEqualTo(420);
        assertThat(calculation.customerQuote().subtotalCents()).isEqualTo(3500);
        assertThat(calculation.customerQuote()).isEqualTo(fixture.service.quote(request));
        assertThat(calculation.customerQuote().totalCents()).isEqualTo(4689);

        ReflectionTestUtils.setField(fixture.policy, "restaurantCommissionBasisPoints", 1500);
        assertThat(fixture.service.calculate(request).restaurantCommissionCents()).isEqualTo(525);

        fixture.addGroup(0, 1);
        var option = fixture.addOption(200, true);
        var modified = fixture.service.calculate(fixture.request(DeliveryMode.GROUPED, fixture.line(2, option.id())));
        assertThat(modified.customerQuote().subtotalCents()).isEqualTo(7400);
        assertThat(modified.restaurantCommissionCents()).isEqualTo(1110);
    }

    @Test
    void appliesModifierPricesPerUnitAndCapsServiceFeeBeforeAddingSubtotalTaxAndDelivery() {
        fixture.addGroup(0, 2);
        var option = fixture.addOption(200, true);
        var quote = fixture.service.quote(fixture.request(DeliveryMode.GROUPED, fixture.line(3, option.id())));
        assertThat(quote.subtotalCents()).isEqualTo(11100);
        assertThat(quote.serviceFeeCents()).isEqualTo(300);
        assertThat(quote.estimatedTaxCents()).isEqualTo(999);
        assertThat(quote.totalCents()).isEqualTo(13098);
        ReflectionTestUtils.setField(fixture.item, "priceCents", 10000);
        assertThat(fixture.service.quote(fixture.request(DeliveryMode.GROUPED, fixture.line(1)))
                .serviceFeeCents()).isEqualTo(300);
    }

    @Test
    void usesTheActivePolicyForAllAmountsAndDemoFlag() {
        ReflectionTestUtils.setField(fixture.policy, "serviceFeeBasisPoints", 100);
        ReflectionTestUtils.setField(fixture.policy, "serviceFeeCapCents", 25);
        ReflectionTestUtils.setField(fixture.policy, "demoTaxBasisPoints", 200);
        ReflectionTestUtils.setField(fixture.policy, "groupedDeliveryFeeCents", 500);
        ReflectionTestUtils.setField(fixture.policy, "directSurchargeCents", 200);
        ReflectionTestUtils.setField(fixture.policy, "demo", false);
        var quote = fixture.service.quote(fixture.request(DeliveryMode.DIRECT, fixture.line(1)));
        assertThat(quote.serviceFeeCents()).isEqualTo(25);
        assertThat(quote.estimatedTaxCents()).isEqualTo(70);
        assertThat(quote.deliveryFeeCents()).isEqualTo(700);
        assertThat(quote.totalCents()).isEqualTo(4295);
        assertThat(quote.demo()).isFalse();
    }

    @Test
    void enforcesRequiredMaximumAndDistinctModifierSelections() {
        fixture.addGroup(1, 1);
        var first = fixture.addOption(0, true);
        var second = fixture.addOption(100, true);
        invalid(fixture.request(DeliveryMode.GROUPED, fixture.line(1)));
        invalid(fixture.request(DeliveryMode.GROUPED, fixture.line(1, first.id(), second.id())));
        invalid(fixture.request(DeliveryMode.GROUPED, fixture.line(1, first.id(), first.id())));
        assertThat(fixture.service.quote(fixture.request(DeliveryMode.GROUPED, fixture.line(1, second.id())))
                .subtotalCents()).isEqualTo(3600);
    }

    @Test
    void rejectsUnknownAndForeignOptionsEvenWhenGroupMinimumIsZero() {
        fixture.addGroup(0, 2);
        invalid(fixture.request(DeliveryMode.GROUPED, fixture.line(1, UUID.randomUUID())));
        var foreign = fixture.addOption(100, true);
        ReflectionTestUtils.setField(foreign, "group", BeanUtils.instantiateClass(ModifierGroup.class));
        invalid(fixture.request(DeliveryMode.GROUPED, fixture.line(1, foreign.id())));
    }

    @Test
    void rejectsInvalidQuantitiesAndMissingOrDuplicateLineData() {
        for (int quantity : new int[] {-1, 0, 21, Integer.MAX_VALUE}) {
            invalid(fixture.request(DeliveryMode.GROUPED, fixture.line(quantity)));
        }
        assertThat(fixture.service.quote(fixture.request(DeliveryMode.GROUPED, fixture.line(20)))
                .subtotalCents()).isEqualTo(70000);
        invalid(null);
        invalid(new QuoteRequest(null, fixture.restaurantId, DeliveryMode.GROUPED, List.of(fixture.line(1))));
        invalid(new QuoteRequest(fixture.locationId, null, DeliveryMode.GROUPED, List.of(fixture.line(1))));
        invalid(fixture.request(null, fixture.line(1)));
        invalid(fixture.request(DeliveryMode.GROUPED));
        invalid(new QuoteRequest(fixture.locationId, fixture.restaurantId, DeliveryMode.GROUPED, null));
        invalid(fixture.request(DeliveryMode.GROUPED, (QuoteRequest.Line) null));
        invalid(fixture.request(DeliveryMode.GROUPED, fixture.line(1), fixture.line(1)));
        invalid(fixture.request(DeliveryMode.GROUPED, new QuoteRequest.Line(" ", fixture.itemId, 1, List.of())));
        invalid(fixture.request(DeliveryMode.GROUPED, new QuoteRequest.Line("a", null, 1, List.of())));
        invalid(fixture.request(DeliveryMode.GROUPED, new QuoteRequest.Line("a", fixture.itemId, 1, null)));
        invalid(fixture.request(DeliveryMode.GROUPED, new QuoteRequest.Line("a", fixture.itemId, 1,
                Arrays.asList((UUID) null))));
    }

    @Test
    void rejectsCrossRestaurantLines() {
        ReflectionTestUtils.setField(fixture.restaurant, "id", UUID.randomUUID());
        invalid(fixture.request(DeliveryMode.GROUPED, fixture.line(1)));
    }

    @Test
    void reportsAllUnavailableLinesAndNeverReturnsAPartialQuote() {
        ReflectionTestUtils.setField(fixture.item, "active", false);
        var missingId = UUID.randomUUID();
        var request = fixture.request(DeliveryMode.GROUPED, fixture.line(1),
                new QuoteRequest.Line("missing", missingId, 1, List.of()));
        assertThatThrownBy(() -> fixture.service.quote(request))
                .isInstanceOfSatisfying(QuoteExceptions.ItemUnavailable.class, exception ->
                        assertThat(exception.details()).containsExactly(
                                new QuoteExceptions.UnavailableLine("line-a", fixture.itemId, "ITEM_INACTIVE"),
                                new QuoteExceptions.UnavailableLine("missing", missingId, "ITEM_NOT_FOUND")));
    }

    @Test
    void inactiveCategoryRestaurantOptionAndGroupCannotBeQuoted() {
        for (var entity : List.of(fixture.category, fixture.restaurant)) {
            ReflectionTestUtils.setField(entity, "active", false);
            unavailable(fixture.request(DeliveryMode.GROUPED, fixture.line(1)));
            ReflectionTestUtils.setField(entity, "active", true);
        }
        fixture.addGroup(0, 1);
        var option = fixture.addOption(0, false);
        unavailable(fixture.request(DeliveryMode.GROUPED, fixture.line(1, option.id())));
        ReflectionTestUtils.setField(option, "active", true);
        ReflectionTestUtils.setField(fixture.group, "active", false);
        unavailable(fixture.request(DeliveryMode.GROUPED, fixture.line(1, option.id())));
        assertThat(fixture.service.quote(fixture.request(DeliveryMode.GROUPED, fixture.line(1))))
                .isNotNull();
    }

    @Test
    void enforcesSelectedDeliveryModeAndCoverage() {
        ReflectionTestUtils.setField(fixture.restaurant, "longitude", 0.0724);
        deliveryUnavailable(DeliveryMode.GROUPED, DeliveryMode.DIRECT);
        assertThat(fixture.service.quote(fixture.request(DeliveryMode.DIRECT, fixture.line(1)))) .isNotNull();
        ReflectionTestUtils.setField(fixture.restaurant, "longitude", 0.09);
        deliveryUnavailable(DeliveryMode.DIRECT);
        ReflectionTestUtils.setField(fixture.restaurant, "longitude", 0.0);
        ReflectionTestUtils.setField(fixture.location, "inCoverage", false);
        deliveryUnavailable(DeliveryMode.GROUPED);
        deliveryUnavailable(DeliveryMode.DIRECT);
    }

    private void invalid(QuoteRequest request) {
        assertThatThrownBy(() -> fixture.service.quote(request)).isInstanceOf(QuoteExceptions.InvalidCart.class);
    }
    private void unavailable(QuoteRequest request) {
        assertThatThrownBy(() -> fixture.service.quote(request)).isInstanceOf(QuoteExceptions.ItemUnavailable.class);
    }
    private void deliveryUnavailable(DeliveryMode mode, DeliveryMode... availableModes) {
        assertThatThrownBy(() -> fixture.service.quote(fixture.request(mode, fixture.line(1))))
                .isInstanceOf(QuoteExceptions.DeliveryUnavailable.class)
                .hasFieldOrPropertyWithValue("availableDeliveryModes", Arrays.asList(availableModes));
    }
}

class QuoteFixture {
    final UUID locationId = UUID.randomUUID(), restaurantId = UUID.randomUUID(), itemId = UUID.randomUUID();
    final Map<UUID, MenuItem> items = new HashMap<>();
    Restaurant restaurant;
    MenuCategory category;
    MenuItem item;
    ModifierGroup group;
    SampleLocation location;
    FeePolicy policy;
    QuoteService service;

    void setUp() {
        restaurant = entity(Restaurant.class, "id", restaurantId, "active", true);
        category = entity(MenuCategory.class, "restaurant", restaurant, "active", true);
        item = entity(MenuItem.class, "id", itemId, "category", category, "priceCents", 3500, "active", true);
        location = entity(SampleLocation.class, "id", locationId, "active", true, "inCoverage", true);
        policy = entity(FeePolicy.class, "active", true, "restaurantCommissionBasisPoints", 1200,
                "serviceFeeBasisPoints", 500, "serviceFeeCapCents", 300, "demoTaxBasisPoints", 900,
                "groupedDeliveryFeeCents", 699, "directSurchargeCents", 450,
                "groupedMaxDistanceMiles", 4.0, "directMaxDistanceMiles", 6.0, "demo", true);
        items.clear(); items.put(itemId, item);
        var policies = repository(FeePolicyRepository.class, "findByActiveTrue", args -> Optional.of(policy));
        var restaurants = repository(RestaurantRepository.class, "findById",
                args -> restaurantId.equals(args[0]) ? Optional.of(restaurant) : Optional.empty());
        var locations = repository(SampleLocationRepository.class, "findById",
                args -> locationId.equals(args[0]) ? Optional.of(location) : Optional.empty());
        var menu = repository(MenuItemRepository.class, "findById", args -> Optional.ofNullable(items.get(args[0])));
        service = new QuoteService(menu, restaurants, policies, new ServiceAreaService(locations, restaurants, policies));
    }

    void addGroup(int min, int max) {
        group = entity(ModifierGroup.class, "id", UUID.randomUUID(), "item", item, "active", true,
                "minSelections", min, "maxSelections", max);
        item.modifierGroups().add(group);
    }
    ModifierOption addOption(int price, boolean active) {
        var option = entity(ModifierOption.class, "id", UUID.randomUUID(), "group", group,
                "active", active, "priceDeltaCents", price);
        group.options().add(option);
        return option;
    }
    QuoteRequest.Line line(int quantity, UUID... options) {
        return new QuoteRequest.Line("line-a", itemId, quantity, Arrays.asList(options));
    }
    QuoteRequest request(DeliveryMode mode, QuoteRequest.Line... lines) {
        return new QuoteRequest(locationId, restaurantId, mode, Arrays.asList(lines));
    }
    static <T> T entity(Class<T> type, Object... fields) {
        var entity = BeanUtils.instantiateClass(type);
        for (int i = 0; i < fields.length; i += 2) ReflectionTestUtils.setField(entity, (String) fields[i], fields[i + 1]);
        return entity;
    }
    private static <T> T repository(Class<T> type, String query, Function<Object[], Object> result) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] {type},
                (proxy, method, args) -> {
                    if (!query.equals(method.getName())) throw new UnsupportedOperationException(method.getName());
                    return result.apply(args);
                }));
    }
}
