package com.foodie.api;

import java.util.Arrays;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;

@TestConfiguration(proxyBeanMethods = false)
public class TestFoodieApiApplication {

    public static void main(String[] args) {
        var demoArgs = Arrays.copyOf(args, args.length + 1);
        demoArgs[args.length] = "--spring.profiles.active=demo";
        SpringApplication.from(FoodieApiApplication::main)
                .with(TestFoodieApiApplication.class)
                .run(demoArgs);
    }

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
        return new PostgreSQLContainer("postgres:18.6");
    }
}
