# Foodie Address, Routing, and Live Quote Inputs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace sample-location-only eligibility with validated customer addresses, ZIP-based pilot zones, road-route estimates, and a tax-provider boundary that can support authoritative live quotes.

**Architecture:** The backend calls Google Address Validation and Routes through Spring `RestClient`; secrets never reach the browser. PostgreSQL stores normalized customer addresses and expiring route results. Existing sample locations continue to drive the demo through the same service-area value objects.

**Tech Stack:** Java 21, Spring Boot `RestClient`, PostgreSQL/Flyway, Google Address Validation API, Google Routes API, Next.js, Vitest, JUnit/Testcontainers

**Spec:** `docs/superpowers/specs/2026-11-04-foodie-demo-and-south-bay-pilot-design.md`

## Global Constraints

- Pilot service is limited to explicitly enabled Santa Clara/San Jose ZIP codes; city text alone never grants eligibility.
- The backend is authoritative for address validation, coordinates, zones, distance, duration, and restaurant eligibility.
- Google keys are backend-only; full addresses, keys, and provider payloads are excluded from logs.
- Grouped deliveries remain at most two orders and at most ten modeled minutes of detour.
- Existing demo location IDs and quote behavior remain supported.
- Tax is a provider result for pilot quotes; the 9% demo estimate must never be returned as live tax.

## Review Focus

- Ambiguous, incomplete, PO-box, out-of-zone, and provider-timeout addresses must fail distinctly without saving junk data.
- Address ownership must prevent one customer from quoting against another customer's saved address.
- Route cache keys must not return another origin/destination result or stale policy decision.
- Exactly one of `locationId` and `deliveryAddressId` is allowed in discovery/quote requests.
- Pilot quotes must fail closed with `TAX_NOT_CONFIGURED` until Plan 6 supplies the live calculator.

---

## File Structure

```text
services/api/src/main/java/com/foodie/api/address/
  AddressValidator.java, GoogleAddressValidator.java
  CustomerAddress.java, AddressService.java, AddressController.java
services/api/src/main/java/com/foodie/api/routing/
  RoutePlanner.java, GoogleRoutePlanner.java, RouteCache.java
services/api/src/main/java/com/foodie/api/tax/TaxCalculator.java
services/api/src/main/java/com/foodie/api/tax/DemoTaxCalculator.java
services/api/src/main/resources/db/common/V5__add_addresses_zones_routes.sql
apps/web/src/app/address/page.tsx
```

### Task 1: Persist Customer Addresses and Pilot Zones

**Files:**
- Create: `services/api/src/main/resources/db/common/V5__add_addresses_zones_routes.sql`
- Create: `services/api/src/main/java/com/foodie/api/address/{CustomerAddress,CustomerAddressRepository,ServiceZone,ServiceZoneRepository}.java`
- Create: `services/api/src/test/java/com/foodie/api/address/AddressPersistenceIntegrationTest.java`

**Interfaces:**
- Consumes: Plan 2 user ID.
- Produces: customer-owned normalized address, provider validation ID, latitude/longitude, `US-CA`, postal code, active flag, optimistic version; active zone and exact allowed ZIP rows; expiring route-cache table.

- [ ] **Step 1: Write failing ownership/constraint/migration tests**

Assert zero pilot zones by default, no fictional pilot address seed, one user cannot query another's address, coordinates/postal/state are required, and inactive addresses are excluded.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test -Dtest=AddressPersistenceIntegrationTest`

- [ ] **Step 3: Add V5 and mappings**

Do not add PostGIS. Use exact ZIP membership plus provider road routes for the initial pilot.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/resources/db/common/V5__add_addresses_zones_routes.sql services/api/src/main/java/com/foodie/api/address services/api/src/test/java/com/foodie/api/address
git commit -m "feat(address): persist customer addresses and zones"
```

### Task 2: Validate Addresses with Google

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/address/AddressValidator.java`
- Create: `services/api/src/main/java/com/foodie/api/address/GoogleAddressValidator.java`
- Create: `services/api/src/main/java/com/foodie/api/address/AddressService.java`
- Create: `services/api/src/main/java/com/foodie/api/address/AddressController.java`
- Create: `services/api/src/main/java/com/foodie/api/address/AddressDtos.java`
- Modify: `services/api/src/main/resources/application-pilot.yml`
- Create: `services/api/src/test/java/com/foodie/api/address/AddressServiceTest.java`
- Create: `services/api/src/test/java/com/foodie/api/address/GoogleAddressValidatorContractTest.java`

**Interfaces:**
- Consumes: authenticated customer and `ValidateAddressRequest(addressLines, locality, regionCode, postalCode)`.
- Produces: `AddressValidator.validate(...) -> ValidatedAddress`; `POST /api/v1/addresses/validate` (preview only); `POST/GET/DELETE /api/v1/addresses`.

- [ ] **Step 1: Write failing service and HTTP-contract tests**

Cover confirmed address, inferred/ambiguous component, PO box, non-CA, out-of-zone ZIP, malformed provider body, 429, timeout, and redacted error behavior.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=AddressServiceTest,GoogleAddressValidatorContractTest'`

- [ ] **Step 3: Implement with Spring `RestClient` and exact endpoint**

POST to `https://addressvalidation.googleapis.com/v1:validateAddress`; read `FOODIE_GOOGLE_MAPS_API_KEY` only server-side. Persist only after the customer confirms the normalized preview.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/address services/api/src/main/resources services/api/src/test/java/com/foodie/api/address
git commit -m "feat(address): validate pilot delivery addresses"
```

### Task 3: Calculate and Cache Road Routes

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/routing/{RoutePlanner,RoutePlan,GoogleRoutePlanner,RouteCache,RouteCacheRepository}.java`
- Modify: `services/api/src/main/java/com/foodie/api/servicearea/ServiceAreaService.java`
- Create: `services/api/src/test/java/com/foodie/api/routing/GoogleRoutePlannerContractTest.java`
- Create: `services/api/src/test/java/com/foodie/api/routing/RouteCacheServiceTest.java`
- Extend: `services/api/src/test/java/com/foodie/api/servicearea/ServiceAreaServiceTest.java`

**Interfaces:**
- Consumes: origin/destination coordinates and policy distance thresholds.
- Produces: `RoutePlanner.plan(List<Stop>) -> RoutePlan(distanceMeters, durationSeconds, orderedStops)`; 24-hour PostgreSQL cache; service-area evaluation from either sample location or customer address.

- [ ] **Step 1: Write failing route/cache/eligibility tests**

Pin cache key to provider+origin+destination+stop order, reject missing route, expire after 24 hours, and evaluate eligibility on unrounded road distance. Provider failure must not fall back to Haversine in PILOT.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=GoogleRoutePlannerContractTest,RouteCacheServiceTest,ServiceAreaServiceTest'`

- [ ] **Step 3: Implement the Routes matrix call**

POST `https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix` with server API key and a minimal field mask. Keep the existing Haversine path only for DEMO sample locations.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/routing services/api/src/main/java/com/foodie/api/servicearea services/api/src/test
git commit -m "feat(routing): use road routes for pilot eligibility"
```

### Task 4: Extend Quotes with Address and Tax Ports

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/tax/{TaxCalculator,TaxQuote,DemoTaxCalculator,PilotTaxUnavailable}.java`
- Modify: `services/api/src/main/java/com/foodie/api/pricing/{QuoteRequest,QuoteResponse,QuoteService,QuoteExceptions}.java`
- Modify: `services/api/src/main/java/com/foodie/api/common/ApiExceptionHandler.java`
- Extend: pricing unit/contract/integration tests

**Interfaces:**
- Consumes: exactly one of `locationId` or `deliveryAddressId` and current actor for owned address lookup.
- Produces: `TaxCalculator.calculate(TaxRequest) -> TaxQuote(amountCents, providerReference)`; quote response adds `taxProviderReference` (null in demo) and changes `demo` type from literal true to boolean.

- [ ] **Step 1: Write failing mutual-exclusion, ownership, tax, and route tests**

Assert sample location uses `DemoTaxCalculator`; pilot address calls `TaxCalculator`; missing pilot calculator returns structured `TAX_NOT_CONFIGURED`; invented/foreign address is rejected without leaking existence.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=QuoteServiceTest,QuoteContractTest,QuoteApiIntegrationTest'`

- [ ] **Step 3: Refactor the current quote calculation once**

Preserve integer cents and server-owned catalog pricing. Do not duplicate demo/pilot quote services.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/tax services/api/src/main/java/com/foodie/api/pricing services/api/src/main/java/com/foodie/api/common services/api/src/test
git commit -m "feat(pricing): quote validated delivery addresses"
```

### Task 5: Add Customer Address Selection

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/features/address/addressApi.ts`
- Create: `apps/web/src/app/address/page.tsx`
- Create: `apps/web/src/components/AddressForm.tsx`
- Create: component/API tests
- Modify: home/discovery/cart navigation to accept `addressId`

**Interfaces:**
- Consumes: Tasks 1–4 APIs and authenticated fetch.
- Produces: validate → review normalized address → save → discover nearby restaurants; existing demo location path remains unchanged.

- [ ] **Step 1: Write failing validation/review/ownership/error-state tests**

Assert no save before explicit confirmation, ambiguous/out-of-zone/provider errors retain user input, and URL state contains only address ID—not the full address or access token.

- [ ] **Step 2: Run RED**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/features/address src/components/AddressForm.test.tsx`

- [ ] **Step 3: Implement the smallest accessible address flow**

No map, autocomplete widget, or saved-address labels beyond one optional short label.

- [ ] **Step 4: Run complete verification**

Run: `pnpm.cmd --filter @foodie/web test -- --run`

Run: `pnpm.cmd --filter @foodie/web build`

Run: `cd services/api; .\mvnw.cmd test`

Run: `git diff --check`

- [ ] **Step 5: Commit**

```bash
git add apps/web README.md
git commit -m "feat(web): add validated delivery addresses"
```
