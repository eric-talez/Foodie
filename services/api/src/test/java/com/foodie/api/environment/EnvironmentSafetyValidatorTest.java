package com.foodie.api.environment;

import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.config.ConfigDataEnvironmentPostProcessor;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EnvironmentSafetyValidatorTest {

    @Test
    void pilotRejectsDemoResetWithRemediation() {
        assertThatThrownBy(() -> EnvironmentSafetyValidator.validate(RuntimeMode.PILOT, false, true,
                Set.of("pilot", "production")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("foodie.runtime.demo-reset-enabled=false");
    }

    @Test
    void rejectsModeAndProfileMismatch() {
        assertThatThrownBy(() -> EnvironmentSafetyValidator.validate(RuntimeMode.DEMO, false, false,
                Set.of("pilot"))).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("foodie.runtime.mode");
        assertThatThrownBy(() -> EnvironmentSafetyValidator.validate(RuntimeMode.PILOT, false, false,
                Set.of("demo"))).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void requiresExactlyOneExplicitRuntimeProfile() {
        for (var profiles : Set.of(Set.<String>of(), Set.of("production"), Set.of("demo", "pilot"))) {
            assertThatThrownBy(() -> EnvironmentSafetyValidator.validate(RuntimeMode.DEMO, false, false,
                    profiles)).isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("spring.profiles.active");
        }
    }

    @Test
    void requiresAnExplicitRuntimeMode() {
        assertThatThrownBy(() -> EnvironmentSafetyValidator.validate(null, false, false, Set.of("demo")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("foodie.runtime.mode");
    }

    @Test
    void permitsMatchingModesAndAdditionalDeploymentProfiles() {
        assertThatCode(() -> EnvironmentSafetyValidator.validate(RuntimeMode.DEMO, false, true, Set.of("demo")))
                .doesNotThrowAnyException();
        assertThatCode(() -> EnvironmentSafetyValidator.validate(RuntimeMode.PILOT, false, false,
                Set.of("pilot", "production"))).doesNotThrowAnyException();
    }

    @Test
    void providerPolicyIsDeferredRatherThanRejectingOrderingHere() {
        assertThatCode(() -> EnvironmentSafetyValidator.validate(RuntimeMode.DEMO, true, false, Set.of("demo")))
                .doesNotThrowAnyException();
    }

    @Test
    void profileConfigurationBindsModesWithOrderingDisabled() {
        runtime("demo").run(context -> {
            assertThat(context).hasNotFailed();
            var properties = context.getBean(FoodieEnvironmentProperties.class);
            assertThat(properties.mode()).isEqualTo(RuntimeMode.DEMO);
            assertThat(properties.orderingEnabled()).isFalse();
        });
        runtime("pilot", "production").run(context -> {
            assertThat(context).hasNotFailed();
            var properties = context.getBean(FoodieEnvironmentProperties.class);
            assertThat(properties.mode()).isEqualTo(RuntimeMode.PILOT);
            assertThat(properties.orderingEnabled()).isFalse();
            assertThat(properties.demoResetEnabled()).isFalse();
        });
    }

    @Test
    void startupRejectsUnsafeBoundConfiguration() {
        runtime("pilot").withPropertyValues("foodie.runtime.demo-reset-enabled=true").run(context -> {
            assertThat(context).hasFailed();
            assertThat(context.getStartupFailure()).hasMessageContaining("foodie.runtime.demo-reset-enabled=false");
        });
        runtime("demo").withPropertyValues("foodie.runtime.mode=PILOT").run(context -> {
            assertThat(context).hasFailed();
            assertThat(context.getStartupFailure()).hasMessageContaining("foodie.runtime.mode");
        });
    }

    @Test
    void defaultProfileDoesNotCountAsExplicitRuntimeSelection() {
        runtime().run(context -> {
            assertThat(context).hasFailed();
            assertThat(context.getStartupFailure()).hasMessageContaining("spring.profiles.active");
        });
    }

    private static ApplicationContextRunner runtime(String... profiles) {
        return new ApplicationContextRunner().withUserConfiguration(EnvironmentSafetyValidator.class)
                .withInitializer(context -> {
                    context.getEnvironment().setActiveProfiles(profiles);
                    ConfigDataEnvironmentPostProcessor.applyTo(context.getEnvironment());
                });
    }
}
