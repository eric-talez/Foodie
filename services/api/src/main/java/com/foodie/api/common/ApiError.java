package com.foodie.api.common;

import java.util.List;

public record ApiError(String code, String message, List<?> details) {

    public ApiError {
        details = List.copyOf(details);
    }

    public static final class NotFoundException extends RuntimeException {

        private final String code;

        public NotFoundException(String code, String message) {
            super(message);
            this.code = code;
        }

        public String code() {
            return code;
        }
    }
}
