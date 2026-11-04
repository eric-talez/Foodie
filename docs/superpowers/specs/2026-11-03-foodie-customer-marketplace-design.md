# Foodie Customer Marketplace Design

**Date:** 2026-11-03  
**Status:** Approved  
**Scope:** Customer-facing website architecture and a demonstrable South Bay pricing model

## Intent

Foodie is a local food-delivery marketplace intended to charge restaurants and customers materially less than large national platforms while paying delivery contractors fairly. The first release proves the customer experience and the architecture that a future mobile app can reuse. It is not a live marketplace: restaurant and menu records are disposable seed data stored in a real database, and checkout stops before account creation, payment, or order submission.

Foodie starts in South Bay, California. Customers at addresses throughout Santa Clara and San Jose can use the site, but they see only restaurants close enough to serve their address. City-wide coverage does not mean any restaurant can deliver to any address.

## Goals

- Deliver a responsive customer journey: location, restaurant discovery, menu, item customization, cart, transparent quote, and checkout preview.
- Demonstrate Foodie's balanced fee model with every customer charge visible before checkout.
- Serve replaceable restaurant and menu fixtures from PostgreSQL through a Java API; do not hardcode catalog data in the browser.
- Use a Java modular monolith whose REST API can later support native mobile clients.
- Keep the initial system small enough to run as one frontend, one backend, and one database.
- Model local eligibility, grouped delivery, and direct delivery without implementing real dispatch.
- Keep money calculations deterministic and testable using integer cents.

## Non-Goals

- Customer, restaurant, or driver accounts.
- Authentication, authorization, sessions, or saved addresses.
- Payment processing, Stripe integration, payouts, refunds, or chargebacks.
- Live order submission, restaurant acceptance, dispatch, driver tracking, or notifications.
- Restaurant or driver portals.
- Production tax calculation, legal fee collection, subscriptions, promotions, loyalty, reviews, or advertising.
- Real-time restaurant availability or inventory.
- Nationwide or state-wide rollout.
- Native mobile applications in this phase.

## Anti-Goals

- Hidden charges or a combined fee line that obscures service and delivery fees.
- Claiming every restaurant delivers across Santa Clara and San Jose.
- Subsidizing long-distance delivery with losses that are invisible in the quote.
- Microservices, Kafka, Redis, Kubernetes, or a separate search system before demonstrated need.
- Frontend-only catalog fixtures that would be discarded when the backend arrives.
- Premature abstractions for payments, users, orders, or dispatch.

## Product Scope

### Customer journey

1. The customer chooses a predefined South Bay sample location. The phase-one selector uses seeded locations and requires no external geocoding key.
2. The site lists seeded restaurants eligible for that location, with cuisine, estimated delivery window, service mode, and delivery fee visible before restaurant selection.
3. The customer opens a restaurant, browses menu categories, and configures an item using required or optional modifier groups.
4. The customer adds items from one restaurant to a cart, edits quantities, and removes items.
5. The backend returns an authoritative demo quote with subtotal, service fee, grouped or direct delivery fee, estimated tax, and total.
6. Checkout preview repeats the complete breakdown and clearly states that ordering is not live.

### Empty and error states

- A location outside the seeded service areas receives an unavailable-area message rather than an empty restaurant grid.
- A valid service location with no eligible restaurants receives a distinct no-restaurants message.
- An invalid restaurant slug or menu item returns a normal not-found response.
- Required modifiers must be selected exactly as the menu rules require.
- A cart cannot combine items from multiple restaurants.
- A quote request with stale or invented prices is recalculated from server-side menu data.
- If an item or modifier has become unavailable, the quote is rejected with the affected lines identified. The frontend preserves the cart and requires the customer to remove or reconfigure those lines before continuing; it does not silently produce a partial quote.

## South Bay Service Model

- Customer coverage: Santa Clara and San Jose addresses, represented by seeded sample locations in phase one.
- Restaurant discovery: show only restaurants within the configured local delivery limit for the selected location.
- Grouped delivery planning default: up to 4 miles, 45–60 minutes, at most two orders, and no more than 10 minutes of modeled detour.
- Direct delivery planning default: up to 6 miles, 25–35 minutes.
- Restaurants outside the applicable limit are not shown as orderable.
- The distance limits are configuration stored with the fee policy, not constants scattered through the frontend.
- Future production dispatch must divide the two cities into local operating zones; cross-zone batching is not part of this release.

The 4-mile and 6-mile limits are design defaults selected for the demo. They must be calibrated with pilot route data before live operations.

## Balanced Business Model

The selected business approach balances charges instead of forcing all economics onto restaurants, customers, or subscriptions.

### Demonstration fee policy

- Restaurant commission: 12% of food subtotal. This is an internal economics field and is not added to the customer's total.
- Customer service fee: 5% of food subtotal, capped at $3.00.
- Grouped delivery fee: $6.99.
- Direct delivery surcharge: $4.50, producing an $11.49 direct delivery fee.
- Driver tips: future policy is 100% to the driver; tips are not collected in phase one.
- Subscription: deferred until repeat-order behavior is known. A future subscription may reduce or waive the service fee, but it must not waive the underlying delivery fee.

### Planning economics

At a $35 food subtotal, the grouped-delivery revenue model is:

| Revenue source | Amount |
|---|---:|
| Restaurant commission | $4.20 |
| Customer service fee | $1.75 |
| Grouped delivery fee | $6.99 |
| Total marketplace revenue | $12.94 |

The planning model assumes a 70% two-order batching rate and approximately $9.07 of allocated contractor compensation per order. Card processing, connected-account payout, insurance, refunds, and support were modeled as an additional approximate $2.80 per order, leaving about $1.07 of contribution before fixed overhead.

These are business-planning assumptions, not production promises. The website may demonstrate the fee formula, but it must label all prices and delivery estimates as sample data. Live pricing requires legal, insurance, payment, tax, and route validation.

### Cost hierarchy

The costs most likely to determine viability are contractor compensation, card processing and payouts, insurance, refunds, customer support, acquisition, and regulatory compliance. Early hosting, maps usage, and domain registration are comparatively small. The product must measure batch success, route duration, distance, average food subtotal, refunds, and support cost before subscription discounts are introduced.

## Approaches Considered

### Business-model approaches

1. **Pass-through cost model:** 8% restaurant commission, 3% service fee, and customer delivery priced at allocated contractor cost. It minimizes platform risk but produces volatile and sometimes high customer delivery prices.
2. **Balanced model — selected:** 12% restaurant commission, 5% capped service fee, a predictable grouped fee, and a direct-delivery surcharge. It remains below large-platform restaurant commissions while sharing delivery economics across participants.
3. **Subscription-led model:** 8% restaurant commission, higher nonmember service fee, and a subscription that removes service fees. It was rejected for launch because retention and order frequency are unknown.

### Technical approaches

1. **Spring Boot modular monolith plus Next.js — selected:** a reusable Java REST API, a responsive TypeScript frontend, and PostgreSQL. It supports a future mobile app without imposing distributed-system operations now.
2. **Spring Boot with server-rendered templates:** simplest deployment, but dynamic ordering interactions and future mobile API reuse would require more rework.
3. **TypeScript full stack:** faster for a JavaScript-only team, but it conflicts with the Java backend preference and offers no decisive advantage for this project.

Microservices were rejected because the release has no live order, payment, or dispatch workload that justifies independent services.

## Technical Architecture

### Repository shape

```text
Foodie/
├── apps/
│   └── web/          # Next.js customer website
├── services/
│   └── api/          # Spring Boot modular monolith
├── docs/             # Design, plans, and operating assumptions
└── compose.yaml      # Local PostgreSQL only when implementation begins
```

- `apps/web` uses TypeScript and the repository's pnpm workspace.
- `services/api` uses Java 21 and a Maven wrapper.
- Frontend and backend remain separate deployables.
- The backend owns catalog, eligibility, and pricing truth.

### Backend modules

- `catalog`: restaurants, menus, menu categories, items, modifier groups, and modifier options.
- `servicearea`: seeded customer locations, restaurant coordinates, distance eligibility, and delivery-mode availability.
- `pricing`: fee policies, monetary calculations, estimated tax inputs, and quote generation.
- `cart`: request validation for items, quantities, modifiers, and single-restaurant enforcement. The persistent cart remains client-side; the server validates quote inputs.

Modules communicate through Java interfaces inside one application. They are packages, not separately deployed services.

### API boundary

The first API version exposes only what the customer journey needs:

- `GET /api/v1/locations` returns seeded South Bay sample locations.
- `GET /api/v1/restaurants?locationId={id}&mode={GROUPED|DIRECT}` returns eligible restaurant summaries.
- `GET /api/v1/restaurants/{slug}` returns one restaurant and its menu.
- `POST /api/v1/quotes` accepts `locationId`, `restaurantId`, `mode`, and selected line items; it returns the validated breakdown and delivery estimate.

There is no checkout, account, order, payment, vendor, driver, or admin endpoint.

### Quote contract

The quote response includes:

- `currency` (`USD`)
- `subtotalCents`
- `serviceFeeCents`
- `deliveryFeeCents`
- `estimatedTaxCents`
- `totalCents`
- `deliveryMode` (`GROUPED` or `DIRECT`)
- `estimatedMinutesMin`
- `estimatedMinutesMax`
- `demo` (`true`)

Restaurant commission is recorded in the fee policy and may be tested internally, but it is not returned as a customer charge.

### Data model

- `restaurant`: identity, slug, display content, latitude, longitude, cuisine, and active flag.
- `menu_category`: restaurant ownership and display order.
- `menu_item`: category ownership, description, price in cents, image reference, and active flag.
- `modifier_group`: item ownership, minimum selections, maximum selections, and display order.
- `modifier_option`: modifier-group ownership, label, price delta in cents, and active flag.
- `sample_location`: label, city, latitude, longitude, and explicit demo-coverage flag.
- `fee_policy`: service percentage basis points, service cap cents, grouped fee cents, direct surcharge cents, grouped/direct distance limits, and demo tax-rate basis points.

No customer, address, order, payment, driver, subscription, or payout tables are created in this phase.

### Seed data

- Seed data is repeatable and replaceable through database migrations or a dedicated development seed mechanism.
- Seed at least six restaurants across Santa Clara and San Jose, with enough cuisines and distance variation to exercise eligibility for both modes, direct-only eligibility, and ineligibility for both modes.
- Each restaurant has a small but realistic menu with at least one required modifier case and one optional modifier case.
- Seeded fee and tax values are explicitly labeled demo data.

### Frontend routes

- `/`: Foodie value proposition and sample-location selection.
- `/restaurants`: eligible restaurant discovery with mode, fee, and ETA visible.
- `/restaurants/[slug]`: menu and item customization.
- `/cart`: editable single-restaurant cart and server-backed quote.
- `/checkout-preview`: complete fee breakdown and ordering-not-live notice.

The frontend stores only the temporary cart locally. Catalog prices and final quote values always come from the API.

## Quality Requirements

- Responsive behavior from mobile width through desktop.
- Keyboard-accessible navigation, forms, dialogs, and item customization.
- Visible labels, error messages, focus states, and sufficient color contrast.
- Integer-cent calculations with explicit rounding tests for percentage fees and tax.
- API validation for IDs, quantities, modifier cardinality, restaurant ownership, delivery eligibility, and stale/invented prices.
- Deterministic seed data and tests.
- Backend unit tests for pricing and eligibility; API integration tests for catalog and quote flows; frontend component tests for cart and fee disclosure; one end-to-end happy-path test.
- No secrets committed and no backend-only configuration exposed through frontend environment variables.

## Failure Boundaries

- If the quote API is unavailable, the frontend preserves the cart but does not invent a total.
- If prices change between selection and quote, the server returns the current validated quote. If an item or modifier becomes unavailable, the server rejects the quote with structured unavailable-line details; the frontend preserves the cart until the customer resolves them.
- If a location or restaurant is ineligible for the chosen mode, the API returns a structured eligibility error and the frontend offers the available mode when one exists.
- Negative prices, zero quantities, excessive quantities, invalid modifier counts, and cross-restaurant cart lines are rejected.
- The demo never implies that an order was placed.

## Deployment Shape

The intended initial deployment is one Next.js application, one Spring Boot application, and one PostgreSQL database. A small Java-capable host and normal database backups are sufficient for the demo. Google Routes, live geocoding, queues, caches, and fleet optimization are not required for phase one.

Operational metrics and production observability are deferred with live ordering. Basic structured application logs and health checks are sufficient for the demo.

## Success Criteria

- A customer can complete the approved journey using database-backed seed data.
- Only restaurants eligible for the selected sample location and delivery mode appear.
- The quote is recalculated server-side and exposes every customer charge.
- Grouped and direct modes produce the selected fee and ETA differences.
- The checkout preview clearly prevents the user from mistaking the demo for a live order.
- The repository remains a modular monolith without unused production subsystems.
- Automated tests cover money rounding, eligibility limits, modifier validation, single-restaurant carts, and the customer happy path.

## Deferred Decisions

- Exact brand visual language, photography, and production copy.
- Production service-area polygons and calibrated distance limits.
- Live tax rates and tax provider.
- Payment processor and marketplace payout design.
- Contractor onboarding, background checks, insurance, and compliance implementation.
- Subscription price and benefits.
- Live batching, dispatch optimization, and driver-pay calculation.
- Production hosting provider and scaling thresholds.

These decisions are intentionally deferred because they do not change the phase-one customer demo architecture.
