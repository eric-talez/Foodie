package com.foodie.api.servicearea;

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
import static org.assertj.core.api.Assertions.catchThrowableOfType;

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "spring.profiles.active=demo")
class ServiceAreaApiIntegrationTest {

    private static final String CENTRAL = "10000000-0000-0000-0000-000000000001";
    private static final String OUTSIDE = "10000000-0000-0000-0000-000000000004";

    @Container
    @ServiceConnection
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18.6");

    @Value("${local.server.port}")
    private int port;

    @Autowired JdbcTemplate jdbc;

    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void groupedReturnsOnlyNearbyRestaurantsWithGroupedFeesAndEta() {
        var response = get("?locationId=" + CENTRAL + "&mode=GROUPED");
        assertEnvelope(response, CENTRAL, true, "GROUPED");
        var restaurants = response.path("restaurants");
        assertThat(restaurants.findValuesAsString("slug")).containsExactly(
                "orchard-bowl-kitchen", "willow-noodle-house", "cedar-flatbread-table", "sunstone-taco-corner");
        assertSummaries(restaurants, "GROUPED", 699, 45, 60);
        assertThat(restaurants.get(0).path("distanceMiles").asDouble()).isZero();
    }

    @Test
    void directIncludesTheDirectOnlyRestaurantWithTotalFeeAndFasterEta() {
        var response = get("?locationId=" + CENTRAL + "&mode=DIRECT");
        assertEnvelope(response, CENTRAL, true, "DIRECT");
        var restaurants = response.path("restaurants");
        assertThat(restaurants.findValuesAsString("slug")).containsExactly(
                "orchard-bowl-kitchen", "willow-noodle-house", "cedar-flatbread-table",
                "sunstone-taco-corner", "juniper-curry-room");
        assertSummaries(restaurants, "DIRECT", 1149, 25, 35);
    }

    @Test
    void outsideLocationReturnsAnEmptyListForBothModes() {
        for (var mode : new String[] {"GROUPED", "DIRECT"}) {
            var response = get("?locationId=" + OUTSIDE + "&mode=" + mode);
            assertEnvelope(response, OUTSIDE, false, mode);
            assertThat(response.path("restaurants").size()).isZero();
        }
    }

    @Test
    void unknownAndInactiveLocationsReturnStructured404() {
        assertError("?locationId=10000000-0000-0000-0000-000000000099&mode=GROUPED", 404, "LOCATION_NOT_FOUND");
        jdbc.update("update sample_location set active = false where id = ?::uuid", CENTRAL);
        try {
            assertError("?locationId=" + CENTRAL + "&mode=GROUPED", 404, "LOCATION_NOT_FOUND");
        } finally {
            jdbc.update("update sample_location set active = true where id = ?::uuid", CENTRAL);
        }
    }

    @Test
    void missingMalformedAndInvalidInputsReturnStructured400() {
        for (var query : new String[] {"", "?mode=GROUPED", "?locationId=" + CENTRAL,
                "?locationId=nope&mode=GROUPED", "?locationId=&mode=GROUPED",
                "?locationId=" + CENTRAL + "&mode=", "?locationId=" + CENTRAL + "&mode=EXPRESS",
                "?locationId=" + CENTRAL + "&mode=grouped"}) {
            assertError(query, 400, "INVALID_REQUEST");
        }
    }

    @Test
    void inactiveRestaurantsAreExcludedFromSearch() {
        jdbc.update("update restaurant set active = false where slug = 'orchard-bowl-kitchen'");
        try {
            assertThat(get("?locationId=" + CENTRAL + "&mode=GROUPED")
                    .path("restaurants").findValuesAsString("slug"))
                    .containsExactly("willow-noodle-house", "cedar-flatbread-table", "sunstone-taco-corner");
        } finally {
            jdbc.update("update restaurant set active = true where slug = 'orchard-bowl-kitchen'");
        }
    }

    private JsonNode get(String query) {
        var response = RestClient.create("http://localhost:" + port).get()
                .uri("/api/v1/restaurants" + query).retrieve().toEntity(String.class);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        return json.readTree(response.getBody());
    }

    private void assertEnvelope(JsonNode response, String locationId, boolean inCoverage, String mode) {
        assertThat(response.propertyNames()).containsExactlyInAnyOrder(
                "locationId", "inCoverage", "deliveryMode", "restaurants");
        assertThat(response.path("locationId").asString()).isEqualTo(locationId);
        assertThat(response.path("inCoverage").asBoolean()).isEqualTo(inCoverage);
        assertThat(response.path("deliveryMode").asString()).isEqualTo(mode);
    }

    private void assertSummaries(JsonNode restaurants, String mode, int fee, int min, int max) {
        for (var restaurant : restaurants) {
            assertThat(restaurant.propertyNames()).containsExactlyInAnyOrder(
                    "id", "slug", "name", "description", "city", "cuisine", "distanceMiles",
                    "deliveryMode", "deliveryFeeCents", "estimatedMinutesMin", "estimatedMinutesMax");
            assertThat(restaurant.path("deliveryMode").asString()).isEqualTo(mode);
            assertThat(restaurant.path("deliveryFeeCents").asInt()).isEqualTo(fee);
            assertThat(restaurant.path("estimatedMinutesMin").asInt()).isEqualTo(min);
            assertThat(restaurant.path("estimatedMinutesMax").asInt()).isEqualTo(max);
        }
    }

    private void assertError(String query, int status, String code) {
        var exception = catchThrowableOfType(HttpClientErrorException.class, () -> get(query));
        assertThat(exception).isNotNull();
        assertThat(exception.getStatusCode().value()).isEqualTo(status);
        var error = json.readTree(exception.getResponseBodyAsString());
        assertThat(error.propertyNames()).containsExactlyInAnyOrder("code", "message", "details");
        assertThat(error.path("code").asString()).isEqualTo(code);
        assertThat(error.path("message").asString()).isNotBlank();
        assertThat(error.path("details").size()).isZero();
    }
}
