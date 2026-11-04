# Foodie Customer Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive, database-backed Foodie customer demo for nearby South Bay restaurants, transparent grouped/direct delivery quotes, a validated cart, and a checkout preview that cannot submit an order.

**Architecture:** A Next.js customer website calls a Java Spring Boot modular monolith through same-origin `/api` rewrites. PostgreSQL stores deterministic demo catalog, service-area, and fee-policy data; the API remains authoritative for eligibility and money calculations. No authentication, payment, order, driver, vendor, or dispatch subsystem is created.

**Tech Stack:** Java 21, Spring Boot 4.1.2, Maven Wrapper, PostgreSQL 18.6, Flyway, Spring Data JPA, Testcontainers, Node.js 24.22.2 LTS, pnpm 12.17.0, Next.js 16.4.0, React 19.3.0, TypeScript, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-11-03-foodie-customer-marketplace-design.md`

## Global Constraints

- Use Java 21 and Spring Boot 4.1.2 under `services/api`; use the Maven Wrapper and do not require a machine-global Maven installation.
- Use Node.js 24.22.2 LTS, pnpm 12.17.0, Next.js 16.4.0, React 19.3.0, and strict TypeScript under `apps/web`.
- Use PostgreSQL 18.6 and Flyway SQL migrations; tests use ephemeral PostgreSQL 18.6 through Testcontainers.
- Use one backend application, one frontend application, and one database. Do not add microservices, queues, caches, generated clients, OpenAPI, Redis, Kafka, or Kubernetes.
- Do not add accounts, authentication, sessions, payments, order submission, subscriptions, restaurant/driver portals, dispatch, tracking, notifications, promotions, reviews, or live maps/geocoding.
- Customer coverage is represented by seeded Santa Clara and San Jose sample locations; restaurant eligibility is local, not city-wide any-to-any delivery.
- Grouped delivery is available at distances `<= 4.0` miles with a 45–60 minute estimate. Direct delivery is available at distances `<= 6.0` miles with a 25–35 minute estimate.
- Restaurant commission is 12% internally. Customer service fee is 5% of food subtotal, rounded half-up to cents and capped at $3.00. Grouped delivery is $6.99; direct delivery is $11.49.
- Demo estimated tax is 9% of food subtotal only and must be labeled estimated/demo data.
- All money is USD integer cents. The browser never supplies trusted prices, totals, or fee values.
- A cart contains one restaurant only. Unavailable items/modifiers reject the quote without deleting or partially quoting the cart.
- The frontend uses same-origin `/api` requests and a server-only `FOODIE_API_ORIGIN`; do not add CORS configuration or expose backend-only settings through `NEXT_PUBLIC_*` variables.
- Preserve keyboard access, semantic labels, visible focus, error text, and mobile-to-desktop responsive behavior.
- Do not run or leave development servers or hidden background processes. Test harnesses may start foreground-managed ephemeral processes and must stop them.

## Review Focus

- **Distance boundaries:** exactly 4.0 miles remains grouped-eligible, exactly 6.0 remains direct-eligible, and values just beyond each boundary change eligibility correctly. Task 4 pins this with boundary unit tests.
- **Money rounding and caps:** half-cent percentage results round half-up, the $3 service cap applies, and the customer total is the sum of disclosed lines. Task 5 pins this with exact-cent tests.
- **Modifier and availability drift:** missing required modifiers, too many selections, cross-item options, inactive items, and inactive modifiers produce the specified errors without a partial quote. Tasks 5 and 8 pin these cases.
- **Cart trust and persistence:** cross-restaurant additions are refused and malformed local storage resets safely without crashing or leaking stale totals. Task 8 pins both cases.
- **Quote failure:** API/network failures and `ITEM_UNAVAILABLE` responses preserve the cart, suppress checkout, and never invent a total. Task 9 pins recovery behavior.

---

## File Structure

```text
Foodie/
├── .editorconfig
├── .gitignore
├── package.json                    # pnpm version and root web scripts
├── pnpm-workspace.yaml
├── compose.yaml                   # local PostgreSQL only; not auto-started
├── README.md                      # setup, validation, architecture, manual QA
├── apps/web/
│   ├── package.json
│   ├── next.config.ts              # same-origin API rewrite
│   ├── playwright.config.ts
│   ├── vitest.config.ts
│   ├── src/app/                    # five customer routes
│   ├── src/components/             # accessible UI by feature
│   ├── src/features/cart/          # reducer, context, local persistence
│   ├── src/lib/api.ts              # small typed fetch client
│   └── tests/e2e/                  # full customer journey
└── services/api/
    ├── pom.xml
    ├── mvnw / mvnw.cmd / .mvn/wrapper/
    ├── src/main/java/com/foodie/api/
    │   ├── catalog/                 # persisted menu/catalog and read APIs
    │   ├── servicearea/             # Haversine distance and mode eligibility
    │   ├── pricing/                 # cart validation and quote calculation
    │   └── common/                  # structured API errors only
    ├── src/main/resources/db/migration/ # schema and deterministic seed data
    └── src/test/                         # unit and PostgreSQL integration tests
```

### Task 1: Establish the Repository and Runtime Baseline

**Files:**
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `pnpm-lock.yaml`
- Create: `compose.yaml`
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/page.test.tsx`
- Create: `services/api/pom.xml`
- Create: `services/api/mvnw`, `services/api/mvnw.cmd`, `services/api/.mvn/wrapper/*`
- Create: `services/api/src/main/java/com/foodie/api/FoodieApiApplication.java`
- Create: `services/api/src/main/resources/application.yml`
- Create: `services/api/src/test/java/com/foodie/api/FoodieApiApplicationTest.java`

**Interfaces:**
- Consumes: approved spec only.
- Produces: pnpm workspace package `@foodie/web`; Spring application `FoodieApiApplication`; `/actuator/health`; same-origin `/api/**` rewrite to `FOODIE_API_ORIGIN` (default `http://localhost:8080`); local PostgreSQL service `foodie-postgres` on the standard port when explicitly started.

- [ ] **Step 1: Create the pinned root, web, Maven, and PostgreSQL manifests**

Pin `packageManager` to `pnpm@12.17.0`, Node to `24.22.2`, Spring Boot parent to `4.1.2`, Java to `21`, and the compose image to `postgres:18.6`. Include only Spring Web, Validation, Data JPA, Flyway, PostgreSQL, Actuator, Test, and Testcontainers dependencies.

- [ ] **Step 2: Install the pinned web dependencies and create the lockfile**

Run: `pnpm.cmd install`

Expected: exit `0` and create `pnpm-lock.yaml` with Next.js `16.4.0`, React `19.3.0`, and the declared test tools resolved.

- [ ] **Step 3: Write the backend smoke test before the application class**

`FoodieApiApplicationTest.contextLoadsAndHealthIsUp()` loads the Spring context with a test PostgreSQL container and asserts `GET /actuator/health` returns `200` and JSON `status == "UP"`.

- [ ] **Step 4: Run the backend test and confirm the intended failure**

Run: `cd services/api; .\mvnw.cmd test -Dtest=FoodieApiApplicationTest`

Expected: FAIL because `FoodieApiApplication` and datasource configuration are not complete.

- [ ] **Step 5: Implement the minimum Spring application and datasource profiles**

Create `FoodieApiApplication`, production environment-variable datasource settings, and Testcontainers-compatible test configuration. Do not add CORS or security configuration.

- [ ] **Step 6: Write the frontend smoke test before the page implementation**

`page.test.tsx` renders the home route and asserts an accessible heading named `Foodie` and the text `Ordering is not live yet`.

- [ ] **Step 7: Run the frontend test and confirm the intended failure**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/app/page.test.tsx`

Expected: FAIL until the minimal page and test setup exist.

- [ ] **Step 8: Implement the minimal layout, page, and same-origin API rewrite**

Keep the page deliberately skeletal; visual/product implementation belongs to Task 6.

- [ ] **Step 9: Verify and commit the foundation**

Run: `cd services/api; .\mvnw.cmd test`

Run: `pnpm.cmd --filter @foodie/web test -- --run`

Run: `pnpm.cmd --filter @foodie/web build`

Expected: all commands exit `0`.

```bash
git add .editorconfig .gitignore package.json pnpm-workspace.yaml pnpm-lock.yaml compose.yaml apps/web services/api
git commit -m "build(repo): scaffold foodie applications"
```

### Task 2: Add the Catalog Schema and Deterministic Demo Data

**Files:**
- Create: `services/api/src/main/resources/db/migration/V1__create_catalog.sql`
- Create: `services/api/src/main/resources/db/migration/V2__seed_demo_data.sql`
- Create: `services/api/src/main/java/com/foodie/api/catalog/Restaurant.java`
- Create: `services/api/src/main/java/com/foodie/api/catalog/MenuCategory.java`
- Create: `services/api/src/main/java/com/foodie/api/catalog/MenuItem.java`
- Create: `services/api/src/main/java/com/foodie/api/catalog/ModifierGroup.java`
- Create: `services/api/src/main/java/com/foodie/api/catalog/ModifierOption.java`
- Create: `services/api/src/main/java/com/foodie/api/catalog/SampleLocation.java`
- Create: `services/api/src/main/java/com/foodie/api/catalog/FeePolicy.java`
- Create: `services/api/src/main/java/com/foodie/api/catalog/RestaurantRepository.java`
- Create: `services/api/src/main/java/com/foodie/api/catalog/MenuItemRepository.java`
- Create: `services/api/src/main/java/com/foodie/api/catalog/SampleLocationRepository.java`
- Create: `services/api/src/main/java/com/foodie/api/catalog/FeePolicyRepository.java`
- Create: `services/api/src/test/java/com/foodie/api/catalog/SeedDataIntegrationTest.java`

**Interfaces:**
- Consumes: PostgreSQL/Flyway baseline from Task 1.
- Produces: JPA entities and repositories for six active restaurants, four sample locations (three with `inCoverage=true` and one with `inCoverage=false`), menu hierarchy, and one active fee policy with exact Global Constraints values.

- [ ] **Step 1: Write the PostgreSQL seed integration test**

`SeedDataIntegrationTest` asserts:

```java
assertThat(locationRepository.count()).isEqualTo(4);
assertThat(restaurantRepository.count()).isEqualTo(6);
assertThat(menuItemRepository.count()).isGreaterThanOrEqualTo(24);
assertThat(feePolicy.serviceFeeBasisPoints()).isEqualTo(500);
assertThat(feePolicy.serviceFeeCapCents()).isEqualTo(300);
assertThat(feePolicy.groupedDeliveryFeeCents()).isEqualTo(699);
assertThat(feePolicy.directSurchargeCents()).isEqualTo(450);
assertThat(feePolicy.demoTaxBasisPoints()).isEqualTo(900);
```

Also assert there is at least one required modifier group and one optional modifier group.

- [ ] **Step 2: Run the seed test and verify it fails**

Run: `cd services/api; .\mvnw.cmd test -Dtest=SeedDataIntegrationTest`

Expected: FAIL because migrations and repositories do not exist.

- [ ] **Step 3: Create the normalized schema and exact entity mappings**

Use UUID primary keys, integer cents/basis points, `double precision` latitude/longitude, explicit foreign keys, uniqueness on restaurant slug, nonnegative checks on prices/selection bounds, and `active` flags. Do not add customer, address, cart, order, payment, driver, or subscription tables.

- [ ] **Step 4: Seed repeatable South Bay demo fixtures**

Seed three selectable locations in Santa Clara/San Jose and one clearly labeled outside-coverage location; seed six fictional restaurants split across the two cities with at least four items each. Seed coordinates that yield examples eligible for both modes, direct only, and neither mode.

- [ ] **Step 5: Verify migrations, constraints, and seed determinism**

Run: `cd services/api; .\mvnw.cmd test -Dtest=SeedDataIntegrationTest`

Expected: PASS on a fresh PostgreSQL container and on a repeated test run.

- [ ] **Step 6: Commit the persistence slice**

```bash
git add services/api/src/main/resources/db services/api/src/main/java/com/foodie/api/catalog services/api/src/test/java/com/foodie/api/catalog
git commit -m "feat(api): add catalog schema and seed data"
```

### Task 3: Expose Locations and Restaurant Menus

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/catalog/CatalogQueryService.java`
- Create: `services/api/src/main/java/com/foodie/api/catalog/LocationController.java`
- Create: `services/api/src/main/java/com/foodie/api/catalog/RestaurantController.java`
- Create: `services/api/src/main/java/com/foodie/api/catalog/CatalogDtos.java`
- Create: `services/api/src/main/java/com/foodie/api/common/ApiError.java`
- Create: `services/api/src/main/java/com/foodie/api/common/ApiExceptionHandler.java`
- Create: `services/api/src/test/java/com/foodie/api/catalog/CatalogApiIntegrationTest.java`

**Interfaces:**
- Consumes: Task 2 repositories and seed data.
- Produces: `GET /api/v1/locations`; `GET /api/v1/restaurants/{slug}`; `CatalogQueryService.listLocations()` and `CatalogQueryService.getRestaurant(String slug)`; errors `RESTAURANT_NOT_FOUND` and `LOCATION_NOT_FOUND` with HTTP 404.

- [ ] **Step 1: Write failing catalog API tests**

Tests assert `/locations` returns four ordered `{id,label,city,inCoverage}` records and `/restaurants/{slug}` returns restaurant identity, ordered categories/items, modifier selection bounds, modifier option price deltas, and no internal commission/fee-policy fields. Unknown slugs return:

```json
{"code":"RESTAURANT_NOT_FOUND","message":"Restaurant not found","details":[]}
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd services/api; .\mvnw.cmd test -Dtest=CatalogApiIntegrationTest`

Expected: FAIL with missing controllers/services.

- [ ] **Step 3: Implement the read-only catalog service and DTO records**

Return immutable DTOs rather than serializing JPA entities. Preserve database display order and filter inactive catalog records from successful responses.

- [ ] **Step 4: Implement controllers and structured 404 handling**

Keep endpoint methods read-only. `ApiExceptionHandler` returns `ApiError(String code, String message, List<?> details)`.

- [ ] **Step 5: Verify catalog behavior**

Run: `cd services/api; .\mvnw.cmd test -Dtest=CatalogApiIntegrationTest`

Expected: PASS.

- [ ] **Step 6: Commit the catalog API**

```bash
git add services/api/src/main/java/com/foodie/api/catalog services/api/src/main/java/com/foodie/api/common services/api/src/test/java/com/foodie/api/catalog
git commit -m "feat(api): expose catalog endpoints"
```

### Task 4: Filter Nearby Restaurants by Delivery Mode

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/servicearea/DeliveryMode.java`
- Create: `services/api/src/main/java/com/foodie/api/servicearea/DistanceCalculator.java`
- Create: `services/api/src/main/java/com/foodie/api/servicearea/DeliveryEligibility.java`
- Create: `services/api/src/main/java/com/foodie/api/servicearea/ServiceAreaService.java`
- Modify: `services/api/src/main/java/com/foodie/api/catalog/RestaurantController.java`
- Modify: `services/api/src/main/java/com/foodie/api/catalog/CatalogDtos.java`
- Create: `services/api/src/test/java/com/foodie/api/servicearea/DistanceCalculatorTest.java`
- Create: `services/api/src/test/java/com/foodie/api/servicearea/ServiceAreaApiIntegrationTest.java`

**Interfaces:**
- Consumes: sample locations, restaurant coordinates, and fee policy from Task 2.
- Produces: `DistanceCalculator.miles(double fromLat, double fromLng, double toLat, double toLng)`; `ServiceAreaService.evaluate(UUID locationId, Restaurant restaurant)`; `GET /api/v1/restaurants?locationId={uuid}&mode={GROUPED|DIRECT}` returning `RestaurantSearchResponse {locationId,inCoverage,deliveryMode,restaurants}`, where each eligible `RestaurantSummary` has `distanceMiles`, `deliveryMode`, `deliveryFeeCents`, `estimatedMinutesMin`, and `estimatedMinutesMax`.

- [ ] **Step 1: Write distance and boundary tests**

Unit tests assert zero distance for identical coordinates and a known one-degree equatorial distance within 0.1 miles. Service tests use controlled coordinates to assert:

```java
assertThat(atFourMiles.groupedAvailable()).isTrue();
assertThat(justOverFourMiles.groupedAvailable()).isFalse();
assertThat(justOverFourMiles.directAvailable()).isTrue();
assertThat(atSixMiles.directAvailable()).isTrue();
assertThat(justOverSixMiles.directAvailable()).isFalse();
```

- [ ] **Step 2: Write failing restaurant-list API tests**

Assert grouped results contain only restaurants at `<= 4.0` miles with fee `699` and ETA `45–60`; direct results contain only restaurants at `<= 6.0` miles with fee `1149` and ETA `25–35`; the outside sample location returns `inCoverage=false` and an empty restaurant list; invalid location/mode inputs return structured 404/400 errors.

- [ ] **Step 3: Run focused tests and verify they fail**

Run: `cd services/api; .\mvnw.cmd test -Dtest=DistanceCalculatorTest,ServiceAreaApiIntegrationTest`

Expected: FAIL because eligibility code and list endpoint do not exist.

- [ ] **Step 4: Implement Haversine distance and eligibility without new infrastructure**

Round displayed distance to one decimal only in the DTO; compare eligibility using the unrounded value. Do not add PostGIS or an external route API.

- [ ] **Step 5: Implement the filtered restaurant-list endpoint**

Sort eligible results by unrounded distance, then restaurant name for stable ties.

- [ ] **Step 6: Verify and commit service-area behavior**

Run: `cd services/api; .\mvnw.cmd test -Dtest=DistanceCalculatorTest,ServiceAreaApiIntegrationTest`

Expected: PASS.

```bash
git add services/api/src/main/java/com/foodie/api/servicearea services/api/src/main/java/com/foodie/api/catalog services/api/src/test/java/com/foodie/api/servicearea
git commit -m "feat(api): filter restaurants by delivery range"
```

### Task 5: Validate Carts and Calculate Transparent Quotes

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/pricing/MoneyMath.java`
- Create: `services/api/src/main/java/com/foodie/api/pricing/QuoteRequest.java`
- Create: `services/api/src/main/java/com/foodie/api/pricing/QuoteResponse.java`
- Create: `services/api/src/main/java/com/foodie/api/pricing/QuoteService.java`
- Create: `services/api/src/main/java/com/foodie/api/pricing/QuoteController.java`
- Create: `services/api/src/main/java/com/foodie/api/pricing/QuoteExceptions.java`
- Modify: `services/api/src/main/java/com/foodie/api/common/ApiExceptionHandler.java`
- Create: `services/api/src/test/java/com/foodie/api/pricing/MoneyMathTest.java`
- Create: `services/api/src/test/java/com/foodie/api/pricing/QuoteServiceTest.java`
- Create: `services/api/src/test/java/com/foodie/api/pricing/QuoteApiIntegrationTest.java`

**Interfaces:**
- Consumes: catalog repositories, `ServiceAreaService`, `DeliveryMode`, and active `FeePolicy`.
- Produces: `POST /api/v1/quotes`; `QuoteService.quote(QuoteRequest)`; customer response fields `currency`, `subtotalCents`, `serviceFeeCents`, `deliveryFeeCents`, `estimatedTaxCents`, `totalCents`, `deliveryMode`, `estimatedMinutesMin`, `estimatedMinutesMax`, and `demo`; errors `INVALID_CART` (422), `DELIVERY_UNAVAILABLE` (422), and `ITEM_UNAVAILABLE` (409 with details shaped as `{lineId,menuItemId,reason}`).

- [ ] **Step 1: Write exact-cent calculation tests**

`MoneyMath.percentageCents(long amountCents, int basisPoints)` uses positive-integer half-up rounding. Tests assert `110` cents at `500` bps is `6`, $35 at 5% is `175`, $35 at 12% is `420`, and a $100 service fee is capped at `300`.

- [ ] **Step 2: Write quote-domain tests before implementation**

For a $35 unmodified subtotal, grouped quote assertions are `subtotal=3500`, `serviceFee=175`, `deliveryFee=699`, `estimatedTax=315`, and `total=4689`; direct total is `5139`. Additional tests assert required/maximum modifier cardinality, option ownership, nonpositive/excessive quantities, cross-restaurant lines, inactive items/options, no partial quote, and mode eligibility.

- [ ] **Step 3: Run pricing tests and verify they fail**

Run: `cd services/api; .\mvnw.cmd test -Dtest=MoneyMathTest,QuoteServiceTest,QuoteApiIntegrationTest`

Expected: FAIL because pricing types and endpoint do not exist.

- [ ] **Step 4: Implement request/response records and authoritative cart validation**

`QuoteRequest` contains only `locationId`, `restaurantId`, `deliveryMode`, and lines of opaque correlation `lineId`, `menuItemId`, `quantity`, and selected `modifierOptionIds`. Do not accept browser prices or totals. Set a conservative maximum quantity of `20` per line.

- [ ] **Step 5: Implement quote calculations and error mapping**

Calculate subtotal from active server records, service/tax from food subtotal, and delivery/ETA from the chosen eligible mode. Compute internal restaurant commission for tests/metrics but do not serialize it to customers.

- [ ] **Step 6: Verify all backend behavior and commit**

Run: `cd services/api; .\mvnw.cmd test`

Expected: PASS with all migrations, catalog, eligibility, validation, and pricing tests.

```bash
git add services/api/src/main/java/com/foodie/api/pricing services/api/src/main/java/com/foodie/api/common services/api/src/test/java/com/foodie/api/pricing
git commit -m "feat(api): add transparent quote calculation"
```

### Task 6: Build the Accessible Foodie Shell and Location Entry

**Files:**
- Create: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/components/SiteHeader.tsx`
- Create: `apps/web/src/components/LocationPicker.tsx`
- Create: `apps/web/src/components/StatusMessage.tsx`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/types.ts`
- Create: `apps/web/src/components/LocationPicker.test.tsx`
- Modify: `apps/web/src/app/page.test.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/locations` from Task 3 through `/api`.
- Produces: `api.getLocations(): Promise<LocationSummary[]>`; a responsive Foodie shell; location selection that navigates to `/restaurants?locationId={uuid}&mode=GROUPED`.

- [ ] **Step 1: Write failing location-entry tests**

Tests mock `getLocations()` and assert loading text, four labeled location options, an explicit outside-coverage label, disabled continuation without a selection, navigation after selection, visible API failure text, and keyboard-accessible native controls.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/app/page.test.tsx src/components/LocationPicker.test.tsx`

Expected: FAIL because the client, picker, and final shell do not exist.

- [ ] **Step 3: Implement the typed fetch client and exact API types**

Use browser `fetch` against relative `/api/v1/...`, parse non-2xx `ApiError`, and expose only endpoint-specific functions. Do not add Axios, generated clients, or global state libraries.

- [ ] **Step 4: Implement the home experience and small CSS design system**

Lead with location selection and Foodie's lower-fee/fair-driver promise. Use system fonts, CSS custom properties, semantic elements, visible focus, and CSS-only responsive layout; do not add a component framework.

- [ ] **Step 5: Verify the slice and production build**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/app/page.test.tsx src/components/LocationPicker.test.tsx`

Run: `pnpm.cmd --filter @foodie/web build`

Expected: PASS and exit `0`.

- [ ] **Step 6: Commit location entry**

```bash
git add apps/web/src/app apps/web/src/components apps/web/src/lib
git commit -m "feat(web): add customer location entry"
```

### Task 7: Add Nearby Restaurant Discovery

**Files:**
- Create: `apps/web/src/app/restaurants/page.tsx`
- Create: `apps/web/src/components/DeliveryModeToggle.tsx`
- Create: `apps/web/src/components/RestaurantCard.tsx`
- Create: `apps/web/src/components/RestaurantList.tsx`
- Create: `apps/web/src/components/RestaurantList.test.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: `GET /api/v1/restaurants?locationId=&mode=` from Task 4 and location/mode query parameters from Task 6.
- Produces: `api.getRestaurants(locationId: string, mode: DeliveryMode): Promise<RestaurantSearchResponse>`; accessible mode toggle; cards that expose cuisine, distance, exact delivery fee, and ETA before restaurant selection.

- [ ] **Step 1: Write failing discovery tests**

Tests assert grouped mode is the default, grouped fee/45–60 ETA are visible, toggling direct refetches and shows direct fee/25–35 ETA, an empty valid result says `No nearby restaurants for this delivery option`, outside coverage is distinct, and API failure offers a retry button.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/components/RestaurantList.test.tsx`

Expected: FAIL because discovery components do not exist.

- [ ] **Step 3: Implement typed discovery loading and URL-synchronized mode**

Reject missing/malformed query values with a link back to location selection. Preserve `locationId` and `mode` in restaurant-detail links.

- [ ] **Step 4: Implement responsive restaurant cards and states**

Use local CSS presentation without external image hosts. Never show an ineligible restaurant as orderable.

- [ ] **Step 5: Verify discovery and commit**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/components/RestaurantList.test.tsx`

Run: `pnpm.cmd --filter @foodie/web build`

Expected: PASS.

```bash
git add apps/web/src/app/restaurants apps/web/src/components apps/web/src/lib apps/web/src/app/globals.css
git commit -m "feat(web): add restaurant discovery"
```

### Task 8: Add Menu Customization and the Single-Restaurant Cart

**Files:**
- Create: `apps/web/src/app/restaurants/[slug]/page.tsx`
- Create: `apps/web/src/components/MenuView.tsx`
- Create: `apps/web/src/components/ItemCustomizer.tsx`
- Create: `apps/web/src/components/ItemCustomizer.test.tsx`
- Create: `apps/web/src/features/cart/cartReducer.ts`
- Create: `apps/web/src/features/cart/CartProvider.tsx`
- Create: `apps/web/src/features/cart/cartStorage.ts`
- Create: `apps/web/src/features/cart/cartReducer.test.ts`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/types.ts`

**Interfaces:**
- Consumes: `GET /api/v1/restaurants/{slug}` from Task 3 and preserved `locationId`/`mode` query values.
- Produces: `CartLine {lineId, restaurantId, menuItemId, itemName, unitPriceCents, quantity, modifierOptionIds, modifierLabels, modifierTotalCents}`; `CartState {restaurantId, lines}`; reducer actions `ADD_LINE`, `SET_QUANTITY`, `REMOVE_LINE`, `CLEAR`; versioned local-storage key `foodie.cart.v1`.

- [ ] **Step 1: Write failing reducer and persistence tests**

Assert add/update/remove/clear behavior, deterministic line identity from item plus sorted option IDs, rejection without mutation when a second restaurant is added, maximum quantity `20`, and safe reset to an empty cart for malformed/version-mismatched local storage.

- [ ] **Step 2: Write failing customization tests**

Assert the add button remains disabled until required selections are satisfied, maximum selections cannot be exceeded, optional modifiers can be omitted, price deltas update the displayed line estimate, Escape closes the dialog and restores focus, and successful add announces the result.

- [ ] **Step 3: Run focused tests and verify they fail**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/features/cart/cartReducer.test.ts src/components/ItemCustomizer.test.tsx`

Expected: FAIL because cart/customization code does not exist.

- [ ] **Step 4: Implement the reducer, context, and guarded persistence**

Use React context/useReducer and browser local storage only; do not add Zustand/Redux. Browser-stored names/prices are display hints only and never trusted by the quote API.

- [ ] **Step 5: Implement menu rendering and accessible item customization**

Use a labeled native dialog or equivalent focus-managed dialog. Render API-defined categories and active items in display order.

- [ ] **Step 6: Verify and commit menu/cart behavior**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/features/cart/cartReducer.test.ts src/components/ItemCustomizer.test.tsx`

Run: `pnpm.cmd --filter @foodie/web build`

Expected: PASS.

```bash
git add apps/web/src/app/restaurants apps/web/src/components apps/web/src/features/cart apps/web/src/lib apps/web/src/app/layout.tsx
git commit -m "feat(web): add menu and cart"
```

### Task 9: Add Server-Backed Cart Quotes and Checkout Preview

**Files:**
- Create: `apps/web/src/app/cart/page.tsx`
- Create: `apps/web/src/app/checkout-preview/page.tsx`
- Create: `apps/web/src/components/CartView.tsx`
- Create: `apps/web/src/components/QuoteSummary.tsx`
- Create: `apps/web/src/components/CheckoutPreview.tsx`
- Create: `apps/web/src/components/CartView.test.tsx`
- Create: `apps/web/src/components/CheckoutPreview.test.tsx`
- Modify: `apps/web/src/features/cart/CartProvider.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/types.ts`

**Interfaces:**
- Consumes: cart interfaces from Task 8 and `POST /api/v1/quotes` from Task 5.
- Produces: `api.createQuote(request: QuoteRequest): Promise<QuoteResponse>`; quote state bound to current cart/location/mode; checkout preview available only for the exact successful quote inputs.

- [ ] **Step 1: Write failing cart-quote tests**

Tests assert quantities/removals trigger a new server quote, all five customer money lines render separately, grouped/direct labels and ETA render, and checkout stays disabled while loading or after any error.

- [ ] **Step 2: Pin failure recovery tests**

Network/API failure must keep lines, hide all prior totals as stale, and show retry. `ITEM_UNAVAILABLE` must keep lines, identify affected items, and require removal/reconfiguration. No failure may navigate or display a partial total.

- [ ] **Step 3: Write failing checkout-preview tests**

Assert the page repeats subtotal, service fee, delivery fee, estimated tax, total, delivery mode, and ETA; displays `Demo pricing` and `Ordering is not live yet`; and contains no enabled order/payment submission control. Missing/stale quote state redirects to `/cart`.

- [ ] **Step 4: Run focused tests and verify they fail**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/components/CartView.test.tsx src/components/CheckoutPreview.test.tsx`

Expected: FAIL because quote/checkout components do not exist.

- [ ] **Step 5: Implement quote requests with stale-response protection**

Abort superseded requests or ignore responses whose request fingerprint no longer matches the current cart/location/mode. Clear displayed totals immediately when inputs change.

- [ ] **Step 6: Implement cart and checkout-preview routes**

Format cents with `Intl.NumberFormat("en-US", {currency: "USD", style: "currency"})`; never recalculate official totals in the browser.

- [ ] **Step 7: Verify and commit the completed customer flow**

Run: `pnpm.cmd --filter @foodie/web test -- --run`

Run: `pnpm.cmd --filter @foodie/web build`

Expected: PASS.

```bash
git add apps/web/src/app/cart apps/web/src/app/checkout-preview apps/web/src/components apps/web/src/features/cart apps/web/src/lib
git commit -m "feat(web): add quote and checkout preview"
```

### Task 10: Add End-to-End Verification and Operator Documentation

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/tests/e2e/customer-journey.spec.ts`
- Create: `apps/web/tests/e2e/error-states.spec.ts`
- Create: `services/api/src/test/java/com/foodie/api/TestFoodieApiApplication.java`
- Create: `README.md`
- Modify: `apps/web/package.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: all API and web interfaces from Tasks 1–9.
- Produces: a Spring `test-run` application that owns its Testcontainers PostgreSQL instance; foreground-managed Playwright web/API startup for tests; root validation scripts; manual QA and operating-assumption documentation.

- [ ] **Step 1: Write the happy-path end-to-end test**

The test chooses an in-coverage sample location, confirms grouped restaurant cards show fee/ETA, opens a restaurant, satisfies a required modifier, adds an item, edits quantity, confirms the server quote line items, opens checkout preview, and verifies no order can be submitted. Repeat the fee/ETA assertion after switching to direct mode.

- [ ] **Step 2: Write end-to-end error and keyboard tests**

Cover outside coverage, browser Back/Forward query preservation, keyboard-only location/menu/cart flow, corrupted cart recovery via seeded local storage, and simulated quote failure with cart preservation/no total.

- [ ] **Step 3: Run end-to-end tests and verify any missing integration fails**

Configure Playwright `webServer` entries to run `mvnw.cmd spring-boot:test-run` from `services/api` and the Next.js test server from `apps/web`. `TestFoodieApiApplication` supplies PostgreSQL 18.6 through a `@ServiceConnection` container. Playwright owns both foreground processes and must terminate them and the container after the run; do not use detached compose or hidden processes.

Run: `pnpm.cmd --filter @foodie/web test:e2e`

Expected before final wiring: FAIL only on identified integration gaps; the test runner must stop every process it starts.

- [ ] **Step 4: Fix only the integration gaps demonstrated by Step 3**

Do not add new product scope. Keep changes within existing API contracts and components.

- [ ] **Step 5: Document setup, constraints, and manual QA**

`README.md` must include prerequisites, install commands, explicit compose start/stop commands (never automatic), API/web validation commands, environment variables, architecture, demo-data reset, non-goals, and manual checks for mobile/desktop, grouped/direct fees, outside coverage, and checkout-not-live behavior.

- [ ] **Step 6: Run the complete raw validation suite**

Run: `cd services/api; .\mvnw.cmd test`

Expected: exit `0`, all backend tests PASS.

Run: `pnpm.cmd --filter @foodie/web test -- --run`

Expected: exit `0`, all component/unit tests PASS.

Run: `pnpm.cmd --filter @foodie/web build`

Expected: exit `0`, Next.js production build succeeds.

Run: `pnpm.cmd --filter @foodie/web test:e2e`

Expected: exit `0`, all Playwright tests PASS and managed processes stop.

Run: `git diff --check`

Expected: exit `0`, no whitespace errors.

- [ ] **Step 7: Commit the verification slice**

```bash
git add README.md package.json apps/web/package.json apps/web/playwright.config.ts apps/web/tests
git commit -m "test(app): verify customer journey"
```

## Plan Self-Review Result

- Spec coverage: all approved customer routes, database-backed fixtures, local eligibility, transparent pricing, error states, non-goals, accessibility, and verification requirements map to Tasks 1–10.
- Step scan: setup is confined to Task 1; every later task begins with a failing behavior test and ends with a focused validation and reviewable commit.
- Type consistency: backend and frontend use `GROUPED|DIRECT`, UUID identifiers, integer cents, the same quote field names, and the same structured error codes throughout.
- Review Focus: all five listed risks have an owning task and explicit test step.
- Proportion: the plan specifies interfaces, exact business values, tests, and commands without transcribing implementation bodies.
