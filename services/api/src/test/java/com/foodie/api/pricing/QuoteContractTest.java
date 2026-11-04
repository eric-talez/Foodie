package com.foodie.api.pricing;

import com.foodie.api.common.ApiExceptionHandler;
import com.foodie.api.servicearea.DeliveryMode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

class QuoteContractTest {
    private final QuoteFixture fixture = new QuoteFixture();
    private final JsonMapper json = JsonMapper.builder().build();
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        fixture.setUp();
        mvc = MockMvcBuilders.standaloneSetup(new QuoteController(fixture.service))
                .setControllerAdvice(new ApiExceptionHandler()).build();
    }

    @Test
    void postsAnAuthoritativeQuoteWithExactlyTheCustomerFieldsAndNoCommission() throws Exception {
        var response = send(body(), 200);
        assertThat(response.propertyNames()).containsExactlyInAnyOrder("currency", "subtotalCents",
                "serviceFeeCents", "deliveryFeeCents", "estimatedTaxCents", "totalCents", "deliveryMode",
                "estimatedMinutesMin", "estimatedMinutesMax", "demo");
        assertThat(response.path("totalCents").asLong()).isEqualTo(4689);
        assertThat(response.path("currency").asString()).isEqualTo("USD");
        assertThat(response.path("demo").asBoolean()).isTrue();
    }

    @Test
    void rejectsBrowserPricesAndTotalsRatherThanBindingThem() throws Exception {
        error(body().replaceFirst("\\{", "{\"totalCents\":1,"), 422, "INVALID_CART");
        error(body().replace("\"quantity\":1", "\"quantity\":1,\"priceCents\":1"), 422, "INVALID_CART");
    }

    @Test
    void malformedMissingAndInvalidRequestBodiesHaveStructuredCartErrors() throws Exception {
        for (var body : new String[] {"", "null", "{", "{}", body().replace("GROUPED", "EXPRESS"),
                body().replace(fixture.itemId.toString(), "not-a-uuid"),
                body().replace("\"quantity\":1", "\"quantity\":0"),
                body().replace("\"quantity\":1", "\"quantity\":1.5"),
                body().replace("\"quantity\":1", "\"quantity\":\"1\""),
                body().replace("\"quantity\":1", "\"quantity\":null")}) {
            error(body, 422, "INVALID_CART");
        }
    }

    @Test
    void unavailableCartReturnsOnlyTheExactLineDetailsAndNoPartialTotals() throws Exception {
        ReflectionTestUtils.setField(fixture.item, "active", false);
        var error = error(body(), 409, "ITEM_UNAVAILABLE");
        var detail = error.path("details").get(0);
        assertThat(detail.propertyNames()).containsExactlyInAnyOrder("lineId", "menuItemId", "reason");
        assertThat(detail.path("lineId").asString()).isEqualTo("line-a");
        assertThat(detail.path("menuItemId").asString()).isEqualTo(fixture.itemId.toString());
        assertThat(detail.path("reason").asString()).isEqualTo("ITEM_INACTIVE");
    }

    @Test
    void unavailableGroupedDeliveryOffersOnlyTheAvailableDirectMode() throws Exception {
        ReflectionTestUtils.setField(fixture.restaurant, "longitude", 0.0724);
        var error = error(body(), 422, "DELIVERY_UNAVAILABLE");
        assertThat(error.path("details").size()).isEqualTo(1);
        var detail = error.path("details").get(0);
        assertThat(detail.propertyNames()).containsExactly("availableDeliveryModes");
        assertThat(detail.path("availableDeliveryModes").size()).isEqualTo(1);
        assertThat(detail.path("availableDeliveryModes").get(0).asString()).isEqualTo("DIRECT");
    }

    @Test
    void unavailableDeliveryAndUnknownLocationsRetainTheirPublicErrors() throws Exception {
        ReflectionTestUtils.setField(fixture.location, "inCoverage", false);
        var outside = error(body(), 422, "DELIVERY_UNAVAILABLE");
        assertThat(outside.path("details").size()).isEqualTo(1);
        assertThat(outside.path("details").get(0).path("availableDeliveryModes").isArray()).isTrue();
        assertThat(outside.path("details").get(0).path("availableDeliveryModes").isEmpty()).isTrue();
        var unknown = error(body().replace(fixture.locationId.toString(), java.util.UUID.randomUUID().toString()),
                404, "LOCATION_NOT_FOUND");
        assertThat(unknown.path("details").isEmpty()).isTrue();
        ReflectionTestUtils.setField(fixture.location, "inCoverage", true);
        ReflectionTestUtils.setField(fixture.restaurant, "longitude", 0.09);
        var tooFar = error(body(), 422, "DELIVERY_UNAVAILABLE");
        assertThat(tooFar.path("details").size()).isEqualTo(1);
        assertThat(tooFar.path("details").get(0).path("availableDeliveryModes").isArray()).isTrue();
        assertThat(tooFar.path("details").get(0).path("availableDeliveryModes").isEmpty()).isTrue();
    }

    private String body() {
        return json.writeValueAsString(fixture.request(DeliveryMode.GROUPED, fixture.line(1)));
    }
    private JsonNode error(String body, int status, String code) throws Exception {
        var error = send(body, status);
        assertThat(error.propertyNames()).containsExactlyInAnyOrder("code", "message", "details");
        assertThat(error.path("code").asString()).isEqualTo(code);
        assertThat(error.path("message").asString()).isNotBlank();
        assertThat(error.path("details").isArray()).isTrue();
        return error;
    }
    private JsonNode send(String body, int status) throws Exception {
        var response = mvc.perform(post("/api/v1/quotes").contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse();
        assertThat(response.getStatus()).as(response.getContentAsString()).isEqualTo(status);
        return json.readTree(response.getContentAsString());
    }
}
