package com.foodie.api.pricing;

import java.util.List;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.foodie.api.servicearea.DeliveryMode;
import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;
import tools.jackson.databind.annotation.JsonDeserialize;

public record QuoteRequest(UUID locationId, UUID restaurantId, DeliveryMode deliveryMode, List<Line> lines) {
    @JsonAnySetter
    public void rejectUnknown(String name, Object value) {
        throw new IllegalArgumentException("Unknown quote field");
    }

    public record Line(String lineId, UUID menuItemId,
                       @JsonDeserialize(using = QuantityDeserializer.class) Integer quantity,
                       List<UUID> modifierOptionIds) {
        @JsonAnySetter
        public void rejectUnknown(String name, Object value) {
            throw new IllegalArgumentException("Unknown quote line field");
        }
    }

    public static final class QuantityDeserializer extends ValueDeserializer<Integer> {
        @Override
        public Integer deserialize(JsonParser parser, DeserializationContext context) {
            if (parser.currentToken() != JsonToken.VALUE_NUMBER_INT) {
                return (Integer) context.handleUnexpectedToken(Integer.class, parser);
            }
            return parser.getIntValue();
        }
    }
}
