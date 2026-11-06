package com.foodie.api.catalog;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.foodie.api.common.ApiError;
import com.foodie.api.common.ApiExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "spring.profiles.active=demo")
class CatalogApiIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18.6");

    @Value("${local.server.port}")
    private int port;

    @Autowired JdbcTemplate jdbc;
    @Autowired CatalogQueryService catalog;

    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void listsFourLocationsInDisplayOrderWithOnlyPublicFields() {
        var locations = get("/api/v1/locations");

        assertThat(locations.size()).isEqualTo(4);
        assertThat(locations.findValuesAsString("label")).containsExactly(
                "Santa Clara Central — demo location", "Downtown San Jose — demo location",
                "North San Jose — demo location", "San Francisco — outside demo coverage");
        assertThat(locations.findValuesAsString("city"))
                .containsExactly("Santa Clara", "San Jose", "San Jose", "San Francisco");
        for (int i = 0; i < 4; i++) {
            var location = locations.get(i);
            assertThat(location.propertyNames()).containsExactlyInAnyOrder("id", "label", "city", "inCoverage");
            assertThat(location.path("id").asString()).isEqualTo("10000000-0000-0000-0000-00000000000" + (i + 1));
            assertThat(location.path("inCoverage").asBoolean()).isEqualTo(i < 3);
        }
    }

    @Test
    void returnsIdentityOrderedMenuAndModifierPricesWithoutInternalFields() {
        var restaurant = get("/api/v1/restaurants/orchard-bowl-kitchen");

        assertThat(restaurant.propertyNames()).containsExactlyInAnyOrder(
                "id", "slug", "name", "description", "city", "cuisine", "categories");
        assertThat(restaurant.path("id").asString()).isEqualTo("20000000-0000-0000-0000-000000000001");
        assertThat(restaurant.path("slug").asString()).isEqualTo("orchard-bowl-kitchen");
        assertThat(restaurant.path("name").asString()).isEqualTo("Orchard Bowl Kitchen");
        assertThat(restaurant.path("description").asString()).isEqualTo("Bright grain bowls and seasonal sides.");
        assertThat(restaurant.path("city").asString()).isEqualTo("Santa Clara");
        assertThat(restaurant.path("cuisine").asString()).isEqualTo("California bowls");
        var categories = restaurant.path("categories");
        assertThat(categories.size()).isEqualTo(2);
        assertThat(categories.get(0).path("name").asString()).isEqualTo("Mains");
        assertThat(categories.get(1).path("name").asString()).isEqualTo("Sides");
        assertThat(categories.get(0).path("items").findValuesAsString("name"))
                .containsExactly("Citrus Chicken Bowl", "Choose your base", "Roasted Vegetable Bowl", "Optional extras");
        assertThat(categories.get(1).path("items").findValuesAsString("name"))
                .containsExactly("Crispy Potatoes", "Cucumber Salad");

        var item = categories.get(0).path("items").get(0);
        assertThat(item.path("priceCents").asInt()).isEqualTo(1450);
        assertThat(item.path("description").asString()).isEqualTo("Grilled chicken, citrus slaw, and herb dressing.");
        assertThat(item.path("imageReference").isNull()).isTrue();
        var required = item.path("modifierGroups").get(0);
        assertThat(required.path("minSelections").asInt()).isEqualTo(1);
        assertThat(required.path("maxSelections").asInt()).isEqualTo(1);
        assertThat(required.path("options").findValuesAsString("label")).containsExactly("Brown rice", "Quinoa");
        assertThat(required.path("options").get(0).path("priceDeltaCents").asInt()).isZero();
        var optional = categories.get(0).path("items").get(1).path("modifierGroups").get(0);
        assertThat(optional.path("minSelections").asInt()).isZero();
        assertThat(optional.path("maxSelections").asInt()).isEqualTo(2);
        assertThat(optional.path("options").findValuesAsString("label")).containsExactly("Avocado", "Roasted seeds");
        assertThat(optional.path("options").get(0).path("priceDeltaCents").asInt()).isEqualTo(200);
        assertThat(optional.path("options").get(1).path("priceDeltaCents").asInt()).isEqualTo(100);
        assertPublicMenuFields(categories);
    }

    @Test
    void returnsStructured404ForUnknownOrInactiveRestaurant() {
        assertRestaurantNotFound("unknown-restaurant");
        jdbc.update("update restaurant set active = false where slug = 'orchard-bowl-kitchen'");
        try {
            assertRestaurantNotFound("orchard-bowl-kitchen");
        } finally {
            jdbc.update("update restaurant set active = true where slug = 'orchard-bowl-kitchen'");
        }
    }

    @Test
    void filtersInactiveRecordsAtEveryCatalogLevel() {
        jdbc.update("update sample_location set active = false where display_order = 2");
        jdbc.update("update menu_category set active = false where name = 'Sides'");
        jdbc.update("update menu_item set active = false where name = 'Citrus Chicken Bowl'");
        jdbc.update("update modifier_group set active = false where id = '50000000-0000-0000-0000-000000000004'");
        jdbc.update("update modifier_option set active = false where label = 'Avocado'");
        try {
            assertThat(get("/api/v1/locations").findValuesAsString("label"))
                    .containsExactly("Santa Clara Central — demo location", "North San Jose — demo location",
                            "San Francisco — outside demo coverage");
            var categories = get("/api/v1/restaurants/orchard-bowl-kitchen").path("categories");
            assertThat(categories.size()).isEqualTo(1);
            var items = categories.get(0).path("items");
            assertThat(items.size()).isEqualTo(1);
            assertThat(items.get(0).path("name").asString()).isEqualTo("Roasted Vegetable Bowl");
            assertThat(items.get(0).path("modifierGroups").get(0).path("options").findValuesAsString("label"))
                    .containsExactly("Roasted seeds");
            var willowItems = get("/api/v1/restaurants/willow-noodle-house")
                    .path("categories").get(0).path("items");
            assertThat(willowItems.get(1).path("modifierGroups").size()).isZero();
        } finally {
            jdbc.update("update sample_location set active = true where display_order = 2");
            jdbc.update("update menu_category set active = true where name = 'Sides'");
            jdbc.update("update menu_item set active = true where name = 'Citrus Chicken Bowl'");
            jdbc.update("update modifier_group set active = true where id = '50000000-0000-0000-0000-000000000004'");
            jdbc.update("update modifier_option set active = true where label = 'Avocado'");
        }
    }

    @Test
    void honorsDatabaseDisplayOrderForCategoriesItemsGroupsAndOptions() {
        jdbc.update("update menu_category set display_order = 3 where id = '30000000-0000-0000-0000-000000000001'");
        jdbc.update("update menu_item set display_order = 3 where id = '40000000-0000-0000-0000-000000000001'");
        jdbc.update("update modifier_group set menu_item_id = '40000000-0000-0000-0000-000000000001', display_order = 0 where id = '50000000-0000-0000-0000-000000000002'");
        jdbc.update("update modifier_option set display_order = 3 where id = '60000000-0000-0000-0000-000000000001'");
        try {
            var categories = get("/api/v1/restaurants/orchard-bowl-kitchen").path("categories");
            assertThat(categories.get(0).path("name").asString()).isEqualTo("Sides");
            var items = categories.get(1).path("items");
            assertThat(items.get(0).path("name").asString()).isEqualTo("Roasted Vegetable Bowl");
            var groups = items.get(1).path("modifierGroups");
            assertThat(groups.get(0).path("name").asString()).isEqualTo("Optional extras");
            assertThat(groups.get(1).path("options").findValuesAsString("label")).containsExactly("Quinoa", "Brown rice");
        } finally {
            jdbc.update("update menu_category set display_order = 1 where id = '30000000-0000-0000-0000-000000000001'");
            jdbc.update("update menu_item set display_order = 1 where id = '40000000-0000-0000-0000-000000000001'");
            jdbc.update("update modifier_group set menu_item_id = '40000000-0000-0000-0000-000000000002', display_order = 1 where id = '50000000-0000-0000-0000-000000000002'");
            jdbc.update("update modifier_option set display_order = 1 where id = '60000000-0000-0000-0000-000000000001'");
        }
    }

    @Test
    void serviceReturnsImmutableDetachedCollections() {
        assertThatThrownBy(() -> catalog.listLocations().clear()).isInstanceOf(UnsupportedOperationException.class);
        var restaurant = catalog.getRestaurant("orchard-bowl-kitchen");
        assertThatThrownBy(() -> restaurant.categories().clear()).isInstanceOf(UnsupportedOperationException.class);
        var category = restaurant.categories().getFirst();
        assertThatThrownBy(() -> category.items().clear()).isInstanceOf(UnsupportedOperationException.class);
        var item = category.items().getFirst();
        assertThatThrownBy(() -> item.modifierGroups().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> item.modifierGroups().getFirst().options().clear())
                .isInstanceOf(UnsupportedOperationException.class);
    }

    private JsonNode get(String path) {
        var response = RestClient.create("http://localhost:" + port).get().uri(path).retrieve().toEntity(String.class);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        return json.readTree(response.getBody());
    }

    private void assertRestaurantNotFound(String slug) {
        var exception = catchThrowableOfType(HttpClientErrorException.NotFound.class,
                () -> get("/api/v1/restaurants/" + slug));
        assertThat(exception).isNotNull();
        assertThat(json.readTree(exception.getResponseBodyAsString()))
                .isEqualTo(json.readTree("{\"code\":\"RESTAURANT_NOT_FOUND\",\"message\":\"Restaurant not found\",\"details\":[]}"));
    }

    private void assertPublicMenuFields(JsonNode categories) {
        for (var category : categories) {
            assertThat(category.propertyNames()).containsExactlyInAnyOrder("id", "name", "items");
            for (var item : category.path("items")) {
                assertThat(item.propertyNames()).containsExactlyInAnyOrder(
                        "id", "name", "description", "priceCents", "imageReference", "modifierGroups");
                for (var group : item.path("modifierGroups")) {
                    assertThat(group.propertyNames()).containsExactlyInAnyOrder(
                            "id", "name", "minSelections", "maxSelections", "options");
                    for (var option : group.path("options")) {
                        assertThat(option.propertyNames()).containsExactlyInAnyOrder("id", "label", "priceDeltaCents");
                    }
                }
            }
        }
    }
}

class CatalogContractTest {

    @Test
    void notFoundErrorsHaveExactPublicPayloadAnd404Status() {
        var json = JsonMapper.builder().build();
        var handler = new ApiExceptionHandler();
        var restaurant = handler.notFound(new ApiError.NotFoundException("RESTAURANT_NOT_FOUND", "Restaurant not found"));
        var location = handler.notFound(new ApiError.NotFoundException("LOCATION_NOT_FOUND", "Location not found"));

        assertThat(restaurant.getStatusCode().value()).isEqualTo(404);
        assertThat(json.<JsonNode>valueToTree(restaurant.getBody())).isEqualTo(json.readTree(
                "{\"code\":\"RESTAURANT_NOT_FOUND\",\"message\":\"Restaurant not found\",\"details\":[]}"));
        assertThat(location.getStatusCode().value()).isEqualTo(404);
        assertThat(json.<JsonNode>valueToTree(location.getBody())).isEqualTo(json.readTree(
                "{\"code\":\"LOCATION_NOT_FOUND\",\"message\":\"Location not found\",\"details\":[]}"));
    }

    @Test
    void menuRecordsDefensivelyCopyEveryCollection() {
        var id = UUID.fromString("40000000-0000-0000-0000-000000000001");
        var options = new ArrayList<>(List.of(new CatalogDtos.Option(id, "Extra", 100)));
        var groups = new ArrayList<>(List.of(new CatalogDtos.Group(id, "Extras", 0, 1, options)));
        var items = new ArrayList<>(List.of(new CatalogDtos.Item(id, "Bowl", "Demo", 1000, null, groups)));
        var categories = new ArrayList<>(List.of(new CatalogDtos.Category(id, "Mains", items)));
        var restaurant = new CatalogDtos.RestaurantMenu(id, "demo", "Demo", "Demo", "San Jose", "Bowls", categories);

        options.clear();
        groups.clear();
        items.clear();
        categories.clear();
        var category = restaurant.categories().getFirst();
        var item = category.items().getFirst();
        var group = item.modifierGroups().getFirst();
        assertThat(group.options()).containsExactly(new CatalogDtos.Option(id, "Extra", 100));
        assertThatThrownBy(() -> restaurant.categories().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> category.items().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> item.modifierGroups().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> group.options().clear()).isInstanceOf(UnsupportedOperationException.class);
    }
}
