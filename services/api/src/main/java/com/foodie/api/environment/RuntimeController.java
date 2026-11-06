package com.foodie.api.environment;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/runtime")
public class RuntimeController {

    private final FoodieEnvironmentProperties properties;

    public RuntimeController(FoodieEnvironmentProperties properties) {
        this.properties = properties;
    }

    @GetMapping
    public RuntimeResponse runtime() {
        return new RuntimeResponse(properties.mode(), properties.orderingEnabled());
    }

    public record RuntimeResponse(RuntimeMode mode, boolean orderingEnabled) {
    }
}
