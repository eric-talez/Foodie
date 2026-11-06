package com.foodie.api.environment;

import java.util.List;
import java.util.Set;

import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
@EnableConfigurationProperties(FoodieEnvironmentProperties.class)
public class EnvironmentSafetyValidator {

    @Bean
    static BeanFactoryPostProcessor runtimeSafetyCheck(Environment environment) {
        // Read Config Data before singleton initialization can run Flyway migrations.
        return beanFactory -> validateConfiguration(environment);
    }

    private static void validateConfiguration(Environment environment) {
        Set<String> profiles = Set.of(environment.getActiveProfiles());
        if (profiles.isEmpty() && environment.matchesProfiles("demo")) {
            profiles = Set.of(environment.getDefaultProfiles());
        }

        var binder = Binder.get(environment);
        var properties = binder.bindOrCreate("foodie.runtime", FoodieEnvironmentProperties.class);
        validate(properties.mode(), properties.orderingEnabled(), properties.demoResetEnabled(), profiles);

        if (properties.mode() == RuntimeMode.PILOT) {
            var locations = binder.bind("spring.flyway.locations", Bindable.listOf(String.class)).orElse(List.of());
            if (!locations.equals(List.of("classpath:db/common"))) {
                throw new IllegalStateException("Set spring.flyway.locations=classpath:db/common for PILOT mode.");
            }
        }
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
