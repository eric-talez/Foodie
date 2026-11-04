package com.foodie.api.pricing;

import java.util.List;
import java.util.UUID;
import com.foodie.api.servicearea.DeliveryMode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class QuoteApiIntegrationTest {
    @Container @ServiceConnection
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18.6");

    @Value("${local.server.port}") private int port;

    @Test
    void pricesSeededPaidModifiersPerUnitThroughThePersistedCatalog() {
        // Two $13.50 vegetable bowls with $2 avocado and $1 seeds each: $33 food.
        var request = new QuoteRequest(UUID.fromString("10000000-0000-0000-0000-000000000001"),
                UUID.fromString("20000000-0000-0000-0000-000000000001"), DeliveryMode.GROUPED,
                List.of(new QuoteRequest.Line("vegetable-bowls", UUID.fromString("40000000-0000-0000-0000-000000000002"),
                        2, List.of(UUID.fromString("60000000-0000-0000-0000-000000000003"),
                                UUID.fromString("60000000-0000-0000-0000-000000000004")))));
        var response = RestClient.create("http://localhost:" + port).post().uri("/api/v1/quotes")
                .contentType(MediaType.APPLICATION_JSON).body(request).retrieve().toEntity(String.class);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        var quote = JsonMapper.builder().build().readTree(response.getBody());
        assertThat(quote.path("subtotalCents").asLong()).isEqualTo(3300);
        assertThat(quote.path("serviceFeeCents").asLong()).isEqualTo(165);
        assertThat(quote.path("deliveryFeeCents").asLong()).isEqualTo(699);
        assertThat(quote.path("estimatedTaxCents").asLong()).isEqualTo(297);
        assertThat(quote.path("totalCents").asLong()).isEqualTo(4461);
    }

    @Test
    void quotesTheSeededServerCatalogAndPolicyThroughHttp() {
        var request = new QuoteRequest(UUID.fromString("10000000-0000-0000-0000-000000000001"),
                UUID.fromString("20000000-0000-0000-0000-000000000001"), DeliveryMode.GROUPED,
                List.of(new QuoteRequest.Line("potatoes", UUID.fromString("40000000-0000-0000-0000-000000000003"),
                        2, List.of())));
        var response = RestClient.create("http://localhost:" + port).post().uri("/api/v1/quotes")
                .contentType(MediaType.APPLICATION_JSON).body(request).retrieve().toEntity(String.class);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        var quote = JsonMapper.builder().build().readTree(response.getBody());
        assertThat(quote.path("subtotalCents").asLong()).isEqualTo(1100);
        assertThat(quote.path("serviceFeeCents").asLong()).isEqualTo(55);
        assertThat(quote.path("estimatedTaxCents").asLong()).isEqualTo(99);
        assertThat(quote.path("totalCents").asLong()).isEqualTo(1953);
    }
}
