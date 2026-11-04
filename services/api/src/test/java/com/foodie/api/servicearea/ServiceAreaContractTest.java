package com.foodie.api.servicearea;

import java.util.List;
import java.util.UUID;

import com.foodie.api.catalog.CatalogDtos;
import com.foodie.api.catalog.RestaurantController;
import com.foodie.api.common.ApiError.NotFoundException;
import com.foodie.api.common.ApiExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

class ServiceAreaContractTest {

    private static final UUID LOCATION_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private final JsonMapper json = JsonMapper.builder().build();
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new RestaurantController(null,
            new ServiceAreaService(null, null, null) {
                @Override
                public CatalogDtos.RestaurantSearchResponse search(UUID locationId, DeliveryMode mode) {
                    if (!LOCATION_ID.equals(locationId)) {
                        throw new NotFoundException("LOCATION_NOT_FOUND", "Location not found");
                    }
                    return new CatalogDtos.RestaurantSearchResponse(locationId, true, mode, List.of(
                            new CatalogDtos.RestaurantSummary(LOCATION_ID, "demo-bowl", "Demo Bowl", "Demo",
                                    "Santa Clara", "Bowls", 1.23, mode, 699, 45, 60)));
                }
            })).setControllerAdvice(new ApiExceptionHandler()).build();

    @Test
    void bindsTheRequestedLocationAndModeAndSerializesThePublicSearchContract() throws Exception {
        for (var mode : new String[] {"GROUPED", "DIRECT"}) {
            var response = mvc.perform(get("/api/v1/restaurants")
                    .param("locationId", LOCATION_ID.toString()).param("mode", mode)).andReturn().getResponse();
            assertThat(response.getStatus()).isEqualTo(200);
            var body = json.readTree(response.getContentAsString());
            assertThat(body.propertyNames()).containsExactlyInAnyOrder(
                    "locationId", "inCoverage", "deliveryMode", "restaurants");
            assertThat(body.path("locationId").asString()).isEqualTo(LOCATION_ID.toString());
            assertThat(body.path("deliveryMode").asString()).isEqualTo(mode);
            assertThat(body.path("inCoverage").asBoolean()).isTrue();
            assertThat(body.path("restaurants").size()).isEqualTo(1);
            var restaurant = body.path("restaurants").get(0);
            assertThat(restaurant.propertyNames()).containsExactlyInAnyOrder("id", "slug", "name",
                    "description", "city", "cuisine", "distanceMiles", "deliveryMode", "deliveryFeeCents",
                    "estimatedMinutesMin", "estimatedMinutesMax");
            assertThat(restaurant.path("distanceMiles").asDouble()).isEqualTo(1.2);
            assertThat(restaurant.path("deliveryMode").asString()).isEqualTo(mode);
        }
    }

    @Test
    void missingLocationOrModeReturnsStructured400() throws Exception {
        assertError("", null, 400, "INVALID_REQUEST");
        assertError(null, "GROUPED", 400, "INVALID_REQUEST");
        assertError(LOCATION_ID.toString(), null, 400, "INVALID_REQUEST");
    }

    @Test
    void malformedLocationOrInvalidModeReturnsStructured400() throws Exception {
        assertError("not-a-uuid", "GROUPED", 400, "INVALID_REQUEST");
        assertError("", "GROUPED", 400, "INVALID_REQUEST");
        assertError(LOCATION_ID.toString(), "", 400, "INVALID_REQUEST");
        assertError(LOCATION_ID.toString(), "EXPRESS", 400, "INVALID_REQUEST");
        assertError(LOCATION_ID.toString(), "grouped", 400, "INVALID_REQUEST");
    }

    @Test
    void unknownLocationRetainsTheApprovedStructured404Contract() throws Exception {
        assertError("10000000-0000-0000-0000-000000000099", "GROUPED", 404, "LOCATION_NOT_FOUND");
    }

    private void assertError(String locationId, String mode, int status, String code) throws Exception {
        var request = get("/api/v1/restaurants");
        if (locationId != null) {
            request.param("locationId", locationId);
        }
        if (mode != null) {
            request.param("mode", mode);
        }
        var response = mvc.perform(request).andReturn().getResponse();
        assertThat(response.getStatus()).isEqualTo(status);
        var error = json.readTree(response.getContentAsString());
        assertThat(error.propertyNames()).containsExactlyInAnyOrder("code", "message", "details");
        assertThat(error.path("code").asString()).isEqualTo(code);
        assertThat(error.path("message").asString()).isNotBlank();
        assertThat(error.path("details").isArray()).isTrue();
        assertThat(error.path("details").size()).isZero();
    }
}
