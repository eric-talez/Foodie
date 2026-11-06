package com.foodie.api.environment;

import java.util.List;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.config.ConfigDataEnvironmentPostProcessor;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.env.MockEnvironment;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;

class FlywayLocationIntegrationTest {

    @Test
    void demoAppliesSchemaAndFictionalSeeds() {
        var locations = migrationLocations("demo");
        assertThat(locations).containsExactly("classpath:db/common", "classpath:db/demo");

        try (var postgres = new PostgreSQLContainer("postgres:18.6")) {
            postgres.start();
            var jdbc = migrate(postgres, locations);

            assertThat(jdbc.queryForObject("select count(*) from restaurant", Long.class)).isEqualTo(6L);
            assertThat(jdbc.queryForObject("select count(*) from sample_location", Long.class)).isEqualTo(4L);
        }
    }

    @Test
    void pilotAppliesSchemaWithoutFictionalRows() {
        var locations = migrationLocations("pilot");
        assertThat(locations).containsExactly("classpath:db/common");
        assertThat(migrationLocations("pilot", "production")).isEqualTo(locations);

        try (var postgres = new PostgreSQLContainer("postgres:18.6")) {
            postgres.start();
            var jdbc = migrate(postgres, locations);

            assertThat(jdbc.queryForObject("select count(*) from restaurant", Long.class)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from sample_location", Long.class)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from fee_policy", Long.class)).isZero();
        }
    }

    private static List<String> migrationLocations(String... profiles) {
        var environment = new MockEnvironment();
        environment.setActiveProfiles(profiles);
        ConfigDataEnvironmentPostProcessor.applyTo(environment);
        return Binder.get(environment).bind("spring.flyway.locations", Bindable.listOf(String.class))
                .orElse(List.of());
    }

    private static JdbcTemplate migrate(PostgreSQLContainer postgres, List<String> locations) {
        var dataSource = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        Flyway.configure().dataSource(dataSource).locations(locations.toArray(String[]::new)).load().migrate();
        return new JdbcTemplate(dataSource);
    }
}
