package com.foodie.api.environment;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("foodie.runtime")
public record FoodieEnvironmentProperties(RuntimeMode mode, boolean orderingEnabled, boolean demoResetEnabled) {
}
