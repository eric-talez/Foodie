package com.foodie.api.pricing;

import java.util.List;
import java.util.UUID;

public final class QuoteExceptions {
    private QuoteExceptions() {}

    public static final class InvalidCart extends RuntimeException {
        public InvalidCart() { super("Cart contains invalid items or selections"); }
    }
    public static final class DeliveryUnavailable extends RuntimeException {
        public DeliveryUnavailable() { super("Selected delivery mode is unavailable for this location and restaurant"); }
    }
    public record UnavailableLine(String lineId, UUID menuItemId, String reason) {}

    public static final class ItemUnavailable extends RuntimeException {
        private final List<UnavailableLine> details;
        public ItemUnavailable(List<UnavailableLine> details) {
            super("One or more cart items are unavailable");
            this.details = List.copyOf(details);
        }
        public List<UnavailableLine> details() { return details; }
    }
}
