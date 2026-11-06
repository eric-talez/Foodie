package com.foodie.api.catalog;

import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE, properties = "spring.profiles.active=demo")
class SeedDataIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18.6");

    @Autowired RestaurantRepository restaurantRepository;
    @Autowired MenuItemRepository menuItemRepository;
    @Autowired SampleLocationRepository locationRepository;
    @Autowired FeePolicyRepository feePolicyRepository;
    @Autowired JdbcTemplate jdbc;
    @Autowired Flyway flyway;

    @Test
    @Transactional
    void seedsActiveDemoCatalogWithOrderedMenusAndExactFeePolicy() {
        assertThat(locationRepository.count()).isEqualTo(4);
        assertThat(restaurantRepository.count()).isEqualTo(6);
        assertThat(menuItemRepository.count()).isGreaterThanOrEqualTo(24);

        var locations = locationRepository.findAllByActiveTrueOrderByDisplayOrderAscIdAsc();
        assertThat(locations).hasSize(4);
        assertThat(locations).filteredOn(SampleLocation::inCoverage).hasSize(3);
        assertThat(locations).filteredOn(location -> !location.inCoverage())
                .extracting(SampleLocation::label).containsExactly("San Francisco — outside demo coverage");
        assertThat(locations).filteredOn(SampleLocation::inCoverage)
                .extracting(SampleLocation::city).containsOnly("Santa Clara", "San Jose");
        assertThat(locations.getFirst().id())
                .isEqualTo(UUID.fromString("10000000-0000-0000-0000-000000000001"));

        var restaurants = restaurantRepository.findAllByActiveTrueOrderByNameAscIdAsc();
        assertThat(restaurants).hasSize(6);
        assertThat(restaurants).extracting(Restaurant::city).contains("Santa Clara", "San Jose");
        for (var restaurant : restaurants) {
            assertThat(restaurantRepository.findBySlugAndActiveTrue(restaurant.slug())).isPresent();
            assertThat(restaurant.categories()).allSatisfy(category -> {
                assertThat(category.restaurant().id()).isEqualTo(restaurant.id());
                assertThat(category.items()).extracting(MenuItem::displayOrder).isSorted();
                assertThat(category.items()).allMatch(item -> item.category().id().equals(category.id()));
            });
            var items = restaurant.categories().stream().flatMap(category -> category.items().stream()).toList();
            assertThat(items).hasSizeGreaterThanOrEqualTo(4).allMatch(MenuItem::active);
            assertThat(restaurant.categories()).extracting(MenuCategory::displayOrder).isSorted();
            var groups = items.stream().flatMap(item -> item.modifierGroups().stream()).toList();
            assertThat(groups).anyMatch(group -> group.minSelections() > 0);
            assertThat(groups).anyMatch(group -> group.minSelections() == 0);
            assertThat(groups).allSatisfy(group -> {
                assertThat(group.item().modifierGroups()).extracting(ModifierGroup::id).contains(group.id());
                assertThat(group.options()).isNotEmpty().allMatch(ModifierOption::active);
                assertThat(group.options()).extracting(ModifierOption::displayOrder).isSorted();
                assertThat(group.options()).allMatch(option -> option.group().id().equals(group.id()));
            });
        }
        var feePolicy = feePolicyRepository.findByActiveTrue().orElseThrow();
        assertThat(feePolicy.serviceFeeBasisPoints()).isEqualTo(500);
        assertThat(feePolicy.serviceFeeCapCents()).isEqualTo(300);
        assertThat(feePolicy.groupedDeliveryFeeCents()).isEqualTo(699);
        assertThat(feePolicy.directSurchargeCents()).isEqualTo(450);
        assertThat(feePolicy.demoTaxBasisPoints()).isEqualTo(900);
        assertThat(feePolicy.restaurantCommissionBasisPoints()).isEqualTo(1200);
        assertThat(feePolicy.groupedMaxDistanceMiles()).isEqualTo(4.0);
        assertThat(feePolicy.directMaxDistanceMiles()).isEqualTo(6.0);
        assertThat(feePolicy.demo()).isTrue();
        assertThat(feePolicyRepository.count()).isEqualTo(1);
    }

    @Test
    void repeatedMigrationDoesNotDuplicateOrReplaceFixtures() {
        var before = jdbc.queryForList("select id, slug from restaurant order by slug");
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        assertThat(jdbc.queryForList("select id, slug from restaurant order by slug")).isEqualTo(before);
        assertThat(locationRepository.count()).isEqualTo(4);
        assertThat(menuItemRepository.count()).isEqualTo(24);
    }

    @Test
    void databaseRejectsInvalidPricesSelectionsSlugsAndOwnership() {
        assertThatThrownBy(() -> jdbc.update("update menu_item set price_cents = -1"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("update modifier_group set min_selections = -1"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("update modifier_group set max_selections = min_selections - 1"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("update modifier_option set price_delta_cents = -1"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("update restaurant set slug = 'duplicate'"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("update menu_item set category_id = ?",
                UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
