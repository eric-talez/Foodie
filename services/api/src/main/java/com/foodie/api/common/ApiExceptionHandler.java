package com.foodie.api.common;

import java.util.List;

import com.foodie.api.pricing.QuoteExceptions;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(QuoteExceptions.InvalidCart.class)
    public ResponseEntity<ApiError> invalidCart() {
        return ResponseEntity.unprocessableContent()
                .body(new ApiError("INVALID_CART", "Cart contains invalid items or selections", List.of()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> invalidBody() {
        return invalidCart();
    }

    @ExceptionHandler(QuoteExceptions.ItemUnavailable.class)
    public ResponseEntity<ApiError> itemUnavailable(QuoteExceptions.ItemUnavailable exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("ITEM_UNAVAILABLE", exception.getMessage(), exception.details()));
    }

    @ExceptionHandler(QuoteExceptions.DeliveryUnavailable.class)
    public ResponseEntity<ApiError> deliveryUnavailable(QuoteExceptions.DeliveryUnavailable exception) {
        return ResponseEntity.unprocessableContent()
                .body(new ApiError("DELIVERY_UNAVAILABLE", exception.getMessage(),
                        List.of(new QuoteExceptions.DeliveryAlternatives(exception.availableDeliveryModes()))));
    }

    @ExceptionHandler(ApiError.NotFoundException.class)
    public ResponseEntity<ApiError> notFound(ApiError.NotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError(exception.code(), exception.getMessage(), List.of()));
    }

    @ExceptionHandler({MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiError> invalidRequest() {
        return ResponseEntity.badRequest()
                .body(new ApiError("INVALID_REQUEST", "Missing or invalid request parameter", List.of()));
    }
}
