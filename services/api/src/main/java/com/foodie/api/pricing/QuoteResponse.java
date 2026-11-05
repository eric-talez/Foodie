package com.foodie.api.pricing;

import com.foodie.api.servicearea.DeliveryMode;

public record QuoteResponse(String currency, long subtotalCents, long serviceFeeCents, long deliveryFeeCents,
                            long estimatedTaxCents, long totalCents, DeliveryMode deliveryMode,
                            int estimatedMinutesMin, int estimatedMinutesMax, boolean demo) {}
