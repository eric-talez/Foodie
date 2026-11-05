package com.foodie.api.pricing;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/quotes")
public class QuoteController {
    private final QuoteService quotes;
    public QuoteController(QuoteService quotes) { this.quotes = quotes; }

    @PostMapping
    public QuoteResponse quote(@RequestBody QuoteRequest request) { return quotes.quote(request); }
}
