package com.foodie.api.environment;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
@EnableConfigurationProperties(FoodieEnvironmentProperties.class)
public class EnvironmentSafetyValidator implements SmartInitializingSingleton {

    private final FoodieEnvironmentProperties properties;
    private final Environment environment;

    public EnvironmentSafetyValidator(FoodieEnvironmentProperties properties, Environment environment) {
        this.properties = properties;
        this.environment = environment;
    }

    @Override
    public void afterSingletonsInstantiated() {
        // Runs before context refresh starts the web server lifecycle.
        validate(properties.mode(), properties.orderingEnabled(), properties.demoResetEnabled(),
                Arrays.stream(environment.getActiveProfiles()).collect(Collectors.toSet()));
    }

    public static void validate(RuntimeMode mode, boolean orderingEnabled, boolean demoResetEnabled,
            Set<String> activeProfiles) {
        boolean demo = activeProfiles.contains("demo");
        boolean pilot = activeProfiles.contains("pilot");
        if (demo == pilot) {
            throw new IllegalStateException("Set spring.profiles.active to exactly one runtime profile: demo or pilot; "
                    + "additional deployment profiles may also be active.");
        }
        if (mode == null || (mode == RuntimeMode.DEMO) != demo) {
            throw new IllegalStateException("Set foodie.runtime.mode to DEMO for the demo profile or PILOT for "
                    + "the pilot profile.");
        }
        if (mode == RuntimeMode.PILOT && demoResetEnabled) {
            throw new IllegalStateException("Set foodie.runtime.demo-reset-enabled=false when using PILOT mode.");
        }
    }
}
