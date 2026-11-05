package com.foodie.api.environment;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

class RuntimeControllerTest {

    @Test
    void exposesOnlyModeAndOrderingEnabledForBothModes() throws Exception {
        for (var mode : RuntimeMode.values()) {
            var properties = new FoodieEnvironmentProperties(mode, false, mode == RuntimeMode.DEMO);
            var mvc = MockMvcBuilders.standaloneSetup(new RuntimeController(properties)).build();

            var response = mvc.perform(get("/api/v1/runtime")).andReturn().getResponse();

            assertThat(response.getStatus()).isEqualTo(200);
            var body = JsonMapper.builder().build().readTree(response.getContentAsString());
            assertThat(body.propertyNames()).containsExactlyInAnyOrder("mode", "orderingEnabled");
            assertThat(body.path("mode").asString()).isEqualTo(mode.name());
            assertThat(body.path("orderingEnabled").asBoolean()).isFalse();
        }
    }

    @Test
    void reflectsTheConfiguredOrderingFlag() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new RuntimeController(
                new FoodieEnvironmentProperties(RuntimeMode.DEMO, true, false))).build();

        var response = mvc.perform(get("/api/v1/runtime")).andReturn().getResponse();

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(JsonMapper.builder().build().readTree(response.getContentAsString())
                .path("orderingEnabled").asBoolean()).isTrue();
    }
}
