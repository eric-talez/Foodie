package com.foodie.api.pricing;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import com.foodie.api.catalog.FeePolicyRepository;
import com.foodie.api.catalog.MenuItem;
import com.foodie.api.catalog.MenuItemRepository;
import com.foodie.api.catalog.ModifierOption;
import com.foodie.api.catalog.RestaurantRepository;
import com.foodie.api.servicearea.DeliveryMode;
import com.foodie.api.servicearea.ServiceAreaService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class QuoteService {
    private final MenuItemRepository items;
    private final RestaurantRepository restaurants;
    private final FeePolicyRepository policies;
    private final ServiceAreaService serviceArea;

    public QuoteService(MenuItemRepository items, RestaurantRepository restaurants, FeePolicyRepository policies,
                        ServiceAreaService serviceArea) {
        this.items = items;
        this.restaurants = restaurants;
        this.policies = policies;
        this.serviceArea = serviceArea;
    }

    public QuoteResponse quote(QuoteRequest request) {
        return calculate(request).customerQuote();
    }

    Calculation calculate(QuoteRequest request) {
        validateRequest(request);
        var restaurant = restaurants.findById(request.restaurantId()).orElseThrow(QuoteExceptions.InvalidCart::new);
        var unavailable = new ArrayList<QuoteExceptions.UnavailableLine>();
        long subtotal = 0;
        for (var line : request.lines()) {
            var item = items.findById(line.menuItemId()).orElse(null);
            if (item == null) {
                unavailable.add(unavailable(line, "ITEM_NOT_FOUND"));
                continue;
            }
            if (!request.restaurantId().equals(item.category().restaurant().id())) {
                throw new QuoteExceptions.InvalidCart();
            }
            String reason = !restaurant.active() ? "RESTAURANT_INACTIVE"
                    : !item.category().active() ? "CATEGORY_INACTIVE" : !item.active() ? "ITEM_INACTIVE" : null;
            if (reason != null) {
                unavailable.add(unavailable(line, reason));
                continue;
            }
            var selected = selectedOptions(item, line);
            if (selected.stream().anyMatch(option -> !option.active() || !option.group().active())) {
                unavailable.add(unavailable(line, "OPTION_INACTIVE"));
                continue;
            }
            for (var group : item.modifierGroups()) {
                if (!group.active()) continue;
                long count = selected.stream().filter(option -> group.id().equals(option.group().id())).count();
                if (count < group.minSelections() || count > group.maxSelections()) throw new QuoteExceptions.InvalidCart();
            }
            long unitPrice = item.priceCents();
            for (var option : selected) unitPrice = Math.addExact(unitPrice, option.priceDeltaCents());
            subtotal = Math.addExact(subtotal, Math.multiplyExact(unitPrice, line.quantity()));
        }
        if (!unavailable.isEmpty()) throw new QuoteExceptions.ItemUnavailable(unavailable);

        var eligibility = serviceArea.evaluate(request.locationId(), restaurant);
        boolean grouped = request.deliveryMode() == DeliveryMode.GROUPED;
        if (!(grouped ? eligibility.groupedAvailable() : eligibility.directAvailable())) {
            var availableModes = new ArrayList<DeliveryMode>();
            if (eligibility.groupedAvailable()) availableModes.add(DeliveryMode.GROUPED);
            if (eligibility.directAvailable()) availableModes.add(DeliveryMode.DIRECT);
            throw new QuoteExceptions.DeliveryUnavailable(availableModes);
        }
        var policy = policies.findByActiveTrue().orElseThrow(() -> new IllegalStateException("No active fee policy"));
        long serviceFee = Math.min(MoneyMath.percentageCents(subtotal, policy.serviceFeeBasisPoints()),
                policy.serviceFeeCapCents());
        long tax = MoneyMath.percentageCents(subtotal, policy.demoTaxBasisPoints());
        long deliveryFee = (long) policy.groupedDeliveryFeeCents() + (grouped ? 0 : policy.directSurchargeCents());
        long total = Math.addExact(Math.addExact(subtotal, serviceFee), Math.addExact(tax, deliveryFee));
        var customerQuote = new QuoteResponse("USD", subtotal, serviceFee, deliveryFee, tax, total, request.deliveryMode(),
                grouped ? 45 : 25, grouped ? 60 : 35, policy.demo());
        return new Calculation(customerQuote,
                MoneyMath.percentageCents(subtotal, policy.restaurantCommissionBasisPoints()));
    }

    record Calculation(QuoteResponse customerQuote, long restaurantCommissionCents) {}

    private void validateRequest(QuoteRequest request) {
        if (request == null || request.locationId() == null || request.restaurantId() == null
                || request.deliveryMode() == null || request.lines() == null || request.lines().isEmpty()) {
            throw new QuoteExceptions.InvalidCart();
        }
        var lineIds = new HashSet<String>();
        for (var line : request.lines()) {
            if (line == null || line.lineId() == null || line.lineId().isBlank() || !lineIds.add(line.lineId())
                    || line.menuItemId() == null || line.quantity() == null || line.quantity() < 1 || line.quantity() > 20
                    || line.modifierOptionIds() == null || line.modifierOptionIds().stream().anyMatch(Objects::isNull)
                    || new HashSet<>(line.modifierOptionIds()).size() != line.modifierOptionIds().size()) {
                throw new QuoteExceptions.InvalidCart();
            }
        }
    }

    private List<ModifierOption> selectedOptions(MenuItem item, QuoteRequest.Line line) {
        var selected = new ArrayList<ModifierOption>();
        for (UUID id : line.modifierOptionIds()) {
            var option = item.modifierGroups().stream().flatMap(group -> group.options().stream())
                    .filter(candidate -> id.equals(candidate.id())).findFirst().orElseThrow(QuoteExceptions.InvalidCart::new);
            if (!item.id().equals(option.group().item() == null ? null : option.group().item().id())
                    || item.modifierGroups().stream().noneMatch(group -> group.id().equals(option.group().id()))) {
                throw new QuoteExceptions.InvalidCart();
            }
            selected.add(option);
        }
        return selected;
    }

    private QuoteExceptions.UnavailableLine unavailable(QuoteRequest.Line line, String reason) {
        return new QuoteExceptions.UnavailableLine(line.lineId(), line.menuItemId(), reason);
    }
}
